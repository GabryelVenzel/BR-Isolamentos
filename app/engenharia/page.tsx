"use client";

import { useEffect, useState } from "react";
import CalculadoraForm, { type EngenhariaFormState } from "@/components/modules/engenharia/CalculadoraForm";
import EconomiaSection, { type EconomiaFormState } from "@/components/modules/engenharia/EconomiaSection";
import ResultadoCard from "@/components/modules/engenharia/ResultadoCard";
import { formatarNumero } from "@/lib/format";
import type { Acabamento, MaterialIsolante } from "@/lib/types";
import type { ResultadoEconomia, ResultadoFrio, ResultadoQuente } from "@/lib/usecases/engenharia";

const FORM_INICIAL: EngenhariaFormState = {
  tipoTrabalho: "quente",
  materialId: undefined,
  acabamentoId: undefined,
  geometria: "tubulacao",
  diametroMm: undefined,
  espessuraMm: undefined,
  temperaturaQuente: undefined,
  temperaturaAmbiente: undefined,
  umidadeRelativa: undefined,
  velocidadeVentoMs: undefined,
};

const ECONOMIA_INICIAL: EconomiaFormState = {
  combustivel: "eletricidade",
  custoCombustivel: undefined,
  horasOperacaoDia: undefined,
  diasOperacaoSemana: undefined,
  valorInvestimento: undefined,
  areaM2: undefined,
};

/**
 * Calculadora rápida quente/frio — módulo Engenharia. Roda só o cálculo
 * térmico (ASTM C680 / ISO 12241 / ABNT NBR 16281) para uma estimativa
 * imediata em campo, sem quantificar materiais nem gerar orçamento (isso
 * continua sendo função do wizard "Novo Orçamento", que também persiste os
 * dados a um cliente). Estado 100% local — não usa o store do wizard.
 *
 * Fiel a 2-DocumentaçãoTecnica/CALCULADORA-TERMICA.py: painel Quente sem
 * campo de vento (pior cenário = sem ventilação), painel Frio com umidade
 * relativa (não ponto de orvalho direto) + vento opcional, economia de
 * energia só disponível no painel Quente. Ver comentários em
 * lib/usecases/engenharia/*.ts pros detalhes de cada divergência resolvida
 * a favor do código Python quando o pedido original divergia dele.
 */
export default function EngenhariaPage() {
  const [materiais, setMateriais] = useState<MaterialIsolante[]>([]);
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([]);

  const [form, setForm] = useState<EngenhariaFormState>(FORM_INICIAL);
  const [economiaAtiva, setEconomiaAtiva] = useState(false);
  const [economiaForm, setEconomiaForm] = useState<EconomiaFormState>(ECONOMIA_INICIAL);

  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultadoQuente, setResultadoQuente] = useState<ResultadoQuente | null>(null);
  const [resultadoFrio, setResultadoFrio] = useState<ResultadoFrio | null>(null);
  const [resultadoEconomia, setResultadoEconomia] = useState<ResultadoEconomia | null>(null);

  useEffect(() => {
    fetch("/api/materiais").then((r) => r.json()).then(setMateriais);
    fetch("/api/acabamentos").then((r) => r.json()).then(setAcabamentos);
  }, []);

  function atualizarForm(patch: Partial<EngenhariaFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function trocarTipo(tipoTrabalho: EngenhariaFormState["tipoTrabalho"]) {
    // Trocar de painel limpa resultado anterior — evita mostrar um
    // resultado "frio" com o formulário já em modo "quente", por exemplo.
    setForm((prev) => ({ ...prev, tipoTrabalho }));
    setResultadoQuente(null);
    setResultadoFrio(null);
    setResultadoEconomia(null);
    setErro(null);
    if (tipoTrabalho === "frio") setEconomiaAtiva(false);
  }

  async function calcular() {
    setErro(null);
    setCalculando(true);
    setResultadoQuente(null);
    setResultadoFrio(null);
    setResultadoEconomia(null);

    try {
      if (form.tipoTrabalho === "quente") {
        const payloadQuente = {
          material_id: form.materialId,
          acabamento_id: form.acabamentoId,
          geometria: form.geometria,
          diametro_mm: form.geometria === "tubulacao" ? form.diametroMm : undefined,
          espessura_mm: form.espessuraMm,
          temperatura_quente: form.temperaturaQuente,
          temperatura_ambiente: form.temperaturaAmbiente,
        };

        const respostaQuente = await fetch("/api/engenharia/calcular-quente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadQuente),
        });
        const dadosQuente = await respostaQuente.json();
        if (!dadosQuente.success) {
          setErro(dadosQuente.error ?? "Erro no cálculo térmico.");
          return;
        }
        setResultadoQuente(dadosQuente.data);

        if (economiaAtiva) {
          const payloadEconomia = {
            perda_com_isolante_kw_m2: dadosQuente.data.perda_com_isolante_kw_m2,
            perda_sem_isolante_kw_m2: dadosQuente.data.perda_sem_isolante_kw_m2,
            area_m2: economiaForm.areaM2,
            combustivel: economiaForm.combustivel,
            custo_combustivel: economiaForm.custoCombustivel,
            horas_operacao_dia: economiaForm.horasOperacaoDia,
            dias_operacao_semana: economiaForm.diasOperacaoSemana,
            valor_investimento: economiaForm.valorInvestimento,
          };

          const respostaEconomia = await fetch("/api/engenharia/economia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadEconomia),
          });
          const dadosEconomia = await respostaEconomia.json();
          if (!dadosEconomia.success) {
            setErro(dadosEconomia.error ?? "Erro ao calcular a economia de energia.");
            return;
          }
          setResultadoEconomia(dadosEconomia.data);
        }
      } else {
        const payloadFrio = {
          material_id: form.materialId,
          geometria: form.geometria,
          diametro_mm: form.geometria === "tubulacao" ? form.diametroMm : undefined,
          temperatura_interna: form.temperaturaQuente,
          temperatura_ambiente: form.temperaturaAmbiente,
          umidade_relativa: form.umidadeRelativa,
          velocidade_vento_ms: form.velocidadeVentoMs ?? 0,
        };

        const respostaFrio = await fetch("/api/engenharia/calcular-frio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFrio),
        });
        const dadosFrio = await respostaFrio.json();
        if (!dadosFrio.success) {
          setErro(dadosFrio.error ?? "Erro no cálculo térmico.");
          return;
        }
        setResultadoFrio(dadosFrio.data);
      }
    } catch {
      setErro("Erro de conexão ao calcular.");
    } finally {
      setCalculando(false);
    }
  }

  function copiarResultadoBase() {
    const material = materiais.find((m) => m.id === form.materialId);
    const linhas: string[] = [`Cálculo térmico — ${material?.nome ?? ""} (${form.tipoTrabalho === "quente" ? "Quente" : "Frio"})`];

    if (resultadoQuente) {
      linhas.push(
        `Espessura necessária: ${formatarNumero(resultadoQuente.espessura_mm, 1)} mm`,
        `Temperatura de face fria: ${formatarNumero(resultadoQuente.temperatura_face_fria, 1)} °C`,
        `Perda térmica com isolante: ${formatarNumero(resultadoQuente.perda_com_isolante_kw_m2, 3)} kW/m²`,
        `Perda térmica sem isolante: ${formatarNumero(resultadoQuente.perda_sem_isolante_kw_m2, 3)} kW/m²`
      );
    }
    if (resultadoFrio) {
      linhas.push(
        `Espessura mínima (evita condensação): ${formatarNumero(resultadoFrio.espessura_minima_mm, 1)} mm`,
        `Temperatura de orvalho: ${formatarNumero(resultadoFrio.temperatura_orvalho, 1)} °C`,
        `Temperatura de face fria alcançada: ${formatarNumero(resultadoFrio.temperatura_face_fria, 1)} °C`
      );
    }

    navigator.clipboard?.writeText(linhas.join("\n"));
  }

  function copiarEconomia() {
    if (!resultadoEconomia) return;
    const linhas = [
      "Economia de energia estimada",
      `Economia: ${formatarNumero(resultadoEconomia.economia_anual_kwh, 0)} kWh/ano`,
      `Economia financeira: ${formatarNumero(resultadoEconomia.economia_financeira_anual, 2)} R$/ano`,
      resultadoEconomia.roi_meses !== null ? `ROI estimado: ${formatarNumero(resultadoEconomia.roi_meses, 0)} meses` : null,
      `Redução de CO₂: ${formatarNumero(resultadoEconomia.co2_reduzido_ton_ano, 2)} ton CO₂/ano`,
    ].filter(Boolean);

    navigator.clipboard?.writeText(linhas.join("\n"));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Engenharia</h1>
        <p className="text-sm text-gray-500">
          Cálculo térmico rápido (quente ou frio) — sem quantificação de materiais nem orçamento. Para gerar uma
          proposta completa, use &quot;Orçamento → Novo Orçamento&quot;.
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-card border-l-4 border-l-status-error bg-red-50 p-4 text-sm text-status-error">
          <span aria-hidden>⚠️</span>
          <p>{erro}</p>
        </div>
      )}

      <CalculadoraForm
        form={{ ...form, tipoTrabalho: form.tipoTrabalho }}
        onChange={(patch) => (patch.tipoTrabalho ? trocarTipo(patch.tipoTrabalho) : atualizarForm(patch))}
        materiais={materiais}
        acabamentos={acabamentos}
      />

      {form.tipoTrabalho === "quente" && (
        <EconomiaSection
          ativo={economiaAtiva}
          onToggle={setEconomiaAtiva}
          form={economiaForm}
          onChange={(patch) => setEconomiaForm((prev) => ({ ...prev, ...patch }))}
          resultado={resultadoEconomia}
          onCopiar={copiarEconomia}
        />
      )}

      <div className="card">
        <button type="button" className="btn-primary" onClick={calcular} disabled={calculando || !form.materialId}>
          {calculando ? "Calculando..." : "Calcular"}
        </button>
      </div>

      <ResultadoCard resultadoQuente={resultadoQuente} resultadoFrio={resultadoFrio} onCopiar={copiarResultadoBase} />
    </div>
  );
}
