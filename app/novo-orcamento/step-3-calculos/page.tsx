"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizardStore } from "@/lib/store";
import { calcularPerimetroTubulacao } from "@/lib/quantificador";
import { formatarNumero } from "@/lib/format";
import TableMateriais from "@/components/TableMateriais";
import type {
  Acabamento,
  CalcularTermicoInput,
  ConfigEmpresa,
  MaterialIsolante,
  PrecoConfig,
  QuantificarInput,
} from "@/lib/types";

export default function Step3CalculosPage() {
  const router = useRouter();
  const {
    especificacoes,
    resultadoTermicoQuente,
    resultadoTermicoFrio,
    quantificacao,
    setResultadoTermicoQuente,
    setResultadoTermicoFrio,
    setQuantificacao,
  } = useWizardStore();

  const [materiais, setMateriais] = useState<MaterialIsolante[]>([]);
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([]);
  const [precos, setPrecos] = useState<PrecoConfig[]>([]);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/materiais").then((r) => r.json()),
      fetch("/api/acabamentos").then((r) => r.json()),
      fetch("/api/precos-config").then((r) => r.json()),
      fetch("/api/config-empresa").then((r) => r.json()),
    ]).then(([m, a, p, c]) => {
      setMateriais(m);
      setAcabamentos(a);
      setPrecos(p);
      setConfig(c);
    });
  }, []);

  const material = materiais.find((m) => m.id === especificacoes.material_id);
  const acabamento = acabamentos.find((a) => a.id === especificacoes.acabamento_id);

  async function calcular() {
    if (!material || !config) return;
    setErro(null);
    setCalculando(true);

    try {
      const espessuraTotalMm = especificacoes.espessuras_mm.reduce((a, b) => a + b, 0);

      const payload: CalcularTermicoInput = {
        tipo_trabalho: especificacoes.tipo_trabalho,
        material_k_func: material.k_func,
        t_min: material.t_min,
        t_max: material.t_max,
        emissividade: acabamento?.emissividade ?? 0.9,
        geometria: especificacoes.geometria,
        diametro_mm: especificacoes.diametro_mm ?? undefined,
        espessuras_mm: especificacoes.espessuras_mm,
        temperatura_quente: especificacoes.temperatura_quente,
        temperatura_ambiente: especificacoes.temperatura_ambiente,
        velocidade_vento_ms: especificacoes.velocidade_vento_ms,
        umidade_relativa: especificacoes.umidade_relativa,
        calcular_financeiro: especificacoes.calcular_financeiro,
        combustivel: especificacoes.combustivel,
        custo_combustivel: especificacoes.custo_combustivel ?? undefined,
        area_m2: especificacoes.area_m2,
        horas_operacao_dia: especificacoes.horas_operacao_dia,
        dias_operacao_semana: especificacoes.dias_operacao_semana,
      };

      const respostaTermico = await fetch("/api/calcular-termico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dadosTermico = await respostaTermico.json();

      if (!respostaTermico.ok) {
        setErro(dadosTermico.error ?? "Erro no cálculo térmico.");
        return;
      }

      let espessuraParaQuantificar = espessuraTotalMm;

      if (especificacoes.tipo_trabalho === "quente") {
        setResultadoTermicoQuente(dadosTermico);
        setResultadoTermicoFrio(null);
      } else {
        setResultadoTermicoFrio(dadosTermico);
        setResultadoTermicoQuente(null);
        espessuraParaQuantificar = dadosTermico.espessura_minima_mm ?? espessuraTotalMm;
      }

      const perimetroM =
        especificacoes.geometria === "tubulacao"
          ? calcularPerimetroTubulacao(especificacoes.diametro_mm ?? 0, espessuraParaQuantificar)
          : especificacoes.perimetro_m ?? 0;

      const chapaConfig = precos.find((p) => p.tipo_material === "chapa");

      const quantInput: QuantificarInput = {
        espessura_mm: espessuraParaQuantificar,
        area_m2: especificacoes.area_m2,
        perimetro_m: perimetroM,
        densidade_manta_kg_m3: material.densidade_kg_m3,
        densidade_chapa_kg_m3: chapaConfig?.densidade_kg_m3 ?? 0,
        vedacit_gramas_por_junta: config.vedacit_gramas_por_junta,
      };

      const respostaQuant = await fetch("/api/quantificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quantInput),
      });
      const dadosQuant = await respostaQuant.json();

      if (!respostaQuant.ok) {
        setErro(dadosQuant.error ?? "Erro na quantificação de materiais.");
        return;
      }

      setQuantificacao(dadosQuant);
    } catch {
      setErro("Erro de conexão ao calcular.");
    } finally {
      setCalculando(false);
    }
  }

  const temResultado = resultadoTermicoQuente || resultadoTermicoFrio;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">3. Cálculos térmicos e quantificação</h1>
        <p className="text-sm text-gray-500">
          Resolução iterativa conforme ASTM C680 / ISO 12241 / ABNT NBR 16281.
        </p>
      </div>

      <div className="card">
        <button type="button" className="btn-primary" onClick={calcular} disabled={calculando || !material}>
          {calculando ? "Calculando..." : "Calcular"}
        </button>
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
      </div>

      {resultadoTermicoQuente && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Resultado térmico</h2>
          <p>🌡️ Temperatura da face fria: <strong>{formatarNumero(resultadoTermicoQuente.temperatura_face_fria, 1)} °C</strong></p>
          {resultadoTermicoQuente.temperaturas_interfaces.map((t, i) => (
            <p key={i} className="text-sm text-gray-600">
              ↪️ Temp. entre camada {i + 1} e {i + 2}: {formatarNumero(t, 1)} °C
            </p>
          ))}
          <p>⚡ Perda de calor com isolante: {formatarNumero(resultadoTermicoQuente.perda_com_isolante_kw_m2, 3)} kW/m²</p>
          <p>⚡ Perda de calor sem isolante: {formatarNumero(resultadoTermicoQuente.perda_sem_isolante_kw_m2, 3)} kW/m²</p>

          {resultadoTermicoQuente.financeiro && (
            <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-gray-500">Economia anual</p>
                <p className="text-lg font-semibold">
                  {formatarNumero(resultadoTermicoQuente.financeiro.economia_anual, 2)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Redução de perda</p>
                <p className="text-lg font-semibold">
                  {formatarNumero(resultadoTermicoQuente.financeiro.reducao_percentual, 1)}%
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">CO₂ evitado/ano</p>
                <p className="text-lg font-semibold">
                  {formatarNumero(resultadoTermicoQuente.financeiro.co2_ton_ano, 2)} t
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {resultadoTermicoFrio && (
        <div className="card space-y-2">
          <h2 className="text-lg font-semibold">Resultado — prevenção de condensação</h2>
          <p>💧 Temperatura de orvalho: {formatarNumero(resultadoTermicoFrio.temperatura_orvalho, 1)} °C</p>
          <p>
            ✅ Espessura mínima recomendada:{" "}
            <strong>{formatarNumero(resultadoTermicoFrio.espessura_minima_mm ?? 0, 1)} mm</strong>
          </p>
        </div>
      )}

      {quantificacao && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quantificação de materiais</h2>
          <TableMateriais quantificacao={quantificacao} />
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.push("/novo-orcamento/step-2-especificacoes")}
        >
          ← Voltar
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!temResultado || !quantificacao}
          onClick={() => router.push("/novo-orcamento/step-4-precos")}
        >
          Próximo →
        </button>
      </div>
    </div>
  );
}
