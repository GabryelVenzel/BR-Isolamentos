"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FormEspecificacoes from "@/components/FormEspecificacoes";
import { useWizardStore } from "@/lib/store";
import { geometriaRepresentativa, somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { acabamentoFisicoMaisProximo, materialFisicoMaisProximo } from "@/lib/usecases/orcamento";
import type { Acabamento, CalcularTermicoInput, MaterialIsolante, PrecoConfig } from "@/lib/types";

/** Tela 3 (refatorada) — especificações técnicas de UM trecho, sempre quente
 * OU frio. O cálculo térmico ("Tela de Cálculos" do wizard antigo) roda
 * automaticamente ao avançar — não é mais uma tela própria — e passa direto
 * pra Preços com o resultado em mãos. */
export default function Step3EspecificacoesPage() {
  const router = useRouter();
  const { clienteSelecionado, itemAtual: especificacoes, escopoAtual, itens, setResultadoAtualQuente, setResultadoAtualFrio } =
    useWizardStore();

  const [materiais, setMateriais] = useState<MaterialIsolante[]>([]);
  const [acabamentosFisicos, setAcabamentosFisicos] = useState<Acabamento[]>([]);
  const [precos, setPrecos] = useState<PrecoConfig[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/materiais").then((r) => r.json()),
      fetch("/api/acabamentos").then((r) => r.json()),
      fetch("/api/precos-config").then((r) => r.json()),
    ]).then(([m, a, p]) => {
      setMateriais(m);
      setAcabamentosFisicos(a);
      setPrecos(p);
    });
  }, []);

  const isQuente = especificacoes.tipo_trabalho === "quente";
  const metragemEscopo = somarMetragemEscopo(escopoAtual);
  const areaM2 = especificacoes.metragem_editada ? (especificacoes.metragem_manual_m2 ?? 0) : metragemEscopo;

  // "Outro material" (migração 019) não tem dado técnico (k(T)/emissividade)
  // cadastrado — um trecho assim não roda o cálculo térmico, só quantificação
  // e preço (ver FormEspecificacoes.tsx). `valido` exige nome + preço em vez
  // do id do catálogo nesse caso.
  const usaIsolanteCustomizado = especificacoes.isolante_customizado_nome != null;
  const usaAcabamentoCustomizado = especificacoes.acabamento_customizado_nome != null;
  const materialCustomizado = usaIsolanteCustomizado || usaAcabamentoCustomizado;
  const isolanteValido = usaIsolanteCustomizado
    ? !!especificacoes.isolante_customizado_nome?.trim() && !!especificacoes.isolante_customizado_preco_m2
    : !!especificacoes.preco_isolante_id;
  const acabamentoValido = usaAcabamentoCustomizado
    ? !!especificacoes.acabamento_customizado_nome?.trim() && !!especificacoes.acabamento_customizado_preco_m2
    : !!especificacoes.preco_acabamento_id;

  const valido =
    isolanteValido &&
    acabamentoValido &&
    especificacoes.temperatura_quente !== null &&
    especificacoes.temperatura_ambiente !== null &&
    areaM2 > 0 &&
    (!isQuente || materialCustomizado || (!!especificacoes.espessura_mm && especificacoes.espessura_mm > 0)) &&
    (isQuente || (especificacoes.umidade_relativa !== null && especificacoes.umidade_relativa > 0)) &&
    (!isQuente || materialCustomizado || (!!especificacoes.custo_combustivel && especificacoes.custo_combustivel > 0));

  async function calcularEContinuar() {
    setErro(null);

    // Material customizado: sem k(T)/emissividade cadastrados, não dá pra
    // rodar o cálculo térmico — segue direto pra Preços só com quantificação
    // (ver aviso em FormEspecificacoes.tsx).
    if (materialCustomizado) {
      setResultadoAtualQuente(null);
      setResultadoAtualFrio(null);
      router.push("/novo-orcamento/step-4-precos");
      return;
    }

    const precoIsolante = precos.find((p) => p.id === especificacoes.preco_isolante_id);
    const precoAcabamento = precos.find((p) => p.id === especificacoes.preco_acabamento_id);
    if (!precoIsolante || !precoAcabamento) return;

    setCalculando(true);
    try {
      const materialFisico = materialFisicoMaisProximo(
        precoIsolante.tipo_material,
        precoIsolante.densidade_kg_m3 ?? 0,
        materiais
      );
      if (!materialFisico) {
        setErro("Não há dado técnico (k(T)) cadastrado para essa família de isolante. Fale com o administrador.");
        return;
      }

      const acabamentoFisico = isQuente
        ? acabamentoFisicoMaisProximo(precoAcabamento.tipo_material, acabamentosFisicos)
        : null;

      const geom = geometriaRepresentativa(escopoAtual);

      const payload: CalcularTermicoInput = {
        tipo_trabalho: especificacoes.tipo_trabalho,
        material_k_func: materialFisico.k_func,
        t_min: materialFisico.t_min,
        t_max: materialFisico.t_max,
        emissividade: isQuente ? acabamentoFisico?.emissividade ?? 0.9 : 0.9,
        geometria: geom.geometria,
        diametro_mm: geom.diametro_mm ?? undefined,
        // Velocidade do vento: sempre 0 no quente (removida do formulário, ver
        // decisão no commit); no frio usa o valor editável do formulário.
        velocidade_vento_ms: isQuente ? 0 : especificacoes.velocidade_vento_ms,
        espessuras_mm: isQuente ? [especificacoes.espessura_mm ?? 0] : [1],
        // `valido` já garante que essas 3 não são null antes de habilitar o botão.
        temperatura_quente: especificacoes.temperatura_quente ?? 0,
        temperatura_ambiente: especificacoes.temperatura_ambiente ?? 0,
        umidade_relativa: isQuente ? undefined : especificacoes.umidade_relativa ?? undefined,
        calcular_financeiro: isQuente,
        combustivel: especificacoes.combustivel,
        custo_combustivel: especificacoes.custo_combustivel ?? undefined,
        area_m2: areaM2,
        horas_operacao_dia: especificacoes.horas_operacao_dia,
        dias_operacao_semana: especificacoes.dias_operacao_semana,
      };

      const resposta = await fetch("/api/calcular-termico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.error ?? "Erro no cálculo térmico.");
        return;
      }

      if (isQuente) {
        setResultadoAtualQuente(dados);
        setResultadoAtualFrio(null);
      } else {
        setResultadoAtualFrio(dados);
        setResultadoAtualQuente(null);
      }

      router.push("/novo-orcamento/step-4-precos");
    } catch {
      setErro("Erro de conexão ao calcular.");
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">3. Especificações técnicas {itens.length > 0 && `— trecho ${itens.length + 1}`}</h1>
        <p className="text-sm text-gray-500">
          Material, temperaturas e economia deste trecho — sempre Quente OU Frio, nunca os dois no mesmo trecho.
        </p>
      </div>

      {!clienteSelecionado && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Selecione um cliente no passo 1 antes de continuar.
        </p>
      )}
      {escopoAtual.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Volte ao Escopo (passo 2) e adicione ao menos um item antes de continuar.
        </p>
      )}

      {itens.length > 0 && (
        <div className="rounded-lg bg-accent-light px-4 py-2 text-sm text-accent-dark">
          {itens.length} trecho(s) já adicionado(s) a este orçamento.
        </div>
      )}

      <FormEspecificacoes />

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      <div className="flex justify-between">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-2-escopo")}>
          ← Voltar
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!valido || !clienteSelecionado || escopoAtual.length === 0 || calculando}
          onClick={calcularEContinuar}
        >
          {calculando ? "Calculando..." : materialCustomizado ? "Continuar →" : "Calcular e continuar →"}
        </button>
      </div>
    </div>
  );
}
