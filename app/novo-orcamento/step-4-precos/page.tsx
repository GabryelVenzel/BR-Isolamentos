"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { horasMaoObraTotal, useWizardStore } from "@/lib/store";
import { precificarTrecho, somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { CalcularOrcamentoInput, ConfigEmpresa, ImpostoConfig, PrecoConfig } from "@/lib/types";

/** Tela 4 (refatorada) — só Preços: os "Cálculos" viraram automáticos (tela
 * anterior). Mostra o resumo técnico do trecho atual + os 2 preços por m²
 * envolvidos (isolante/acabamento), editáveis SÓ PARA ESTE ORÇAMENTO (não
 * altera o catálogo em Configurar Preços — mesmo raciocínio do pedido:
 * "original mantém, apenas este orçamento usa novo valor"). Ao confirmar, o
 * trecho entra na lista e — se for pra Revisão — o orçamento inteiro é
 * calculado (impostos/margem reais, ver lib/orcamento.ts) automaticamente. */
export default function Step4PrecosPage() {
  const router = useRouter();
  const {
    itemAtual: especificacoes,
    escopoAtual,
    resultadoTermicoQuenteAtual,
    resultadoTermicoFrioAtual,
    itens,
    custosOperacionais,
    confirmarItemAtual,
    setResultadoOrcamento,
  } = useWizardStore();

  const [precos, setPrecos] = useState<PrecoConfig[]>([]);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [impostosExtras, setImpostosExtras] = useState<ImpostoConfig[]>([]);
  const [precoIsolanteOverride, setPrecoIsolanteOverride] = useState<number | null>(null);
  const [precoAcabamentoOverride, setPrecoAcabamentoOverride] = useState<number | null>(null);
  const [salvando, setSalvando] = useState<"trecho" | "revisao" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/precos-config").then((r) => r.json()),
      fetch("/api/config-empresa").then((r) => r.json()),
      fetch("/api/impostos-config").then((r) => r.json()),
    ]).then(([p, c, i]) => {
      setPrecos(p);
      setConfig(c);
      setImpostosExtras(i);
    });
  }, []);

  const precoIsolante = precos.find((p) => p.id === especificacoes.preco_isolante_id);
  const precoAcabamento = precos.find((p) => p.id === especificacoes.preco_acabamento_id);
  const temResultado = !!(resultadoTermicoQuenteAtual || resultadoTermicoFrioAtual);
  const metragem = especificacoes.metragem_editada ? especificacoes.metragem_manual_m2 ?? 0 : somarMetragemEscopo(escopoAtual);

  const valorIsolanteM2 = precoIsolanteOverride ?? precoIsolante?.preco_unitario ?? 0;
  const valorAcabamentoM2 = precoAcabamentoOverride ?? precoAcabamento?.preco_unitario ?? 0;

  const precificacao =
    config && temResultado
      ? precificarTrecho({
          escopoItens: escopoAtual,
          precoIsolanteM2: valorIsolanteM2,
          precoAcabamentoM2: valorAcabamentoM2,
          horasMaoObra: especificacoes.horas_mao_obra,
          valorHoraMaoObra: config.valor_hora_mao_obra,
        })
      : null;

  function montarPayloadConfirmacao() {
    if (!precoIsolante || !precoAcabamento || !precificacao) return null;
    return {
      materialNome: precoIsolante.descricao,
      acabamentoNome: precoAcabamento.descricao,
      especificacaoIsolante: precoIsolante.especificacao,
      especificacaoAcabamento: precoAcabamento.especificacao,
      precificacao,
    };
  }

  function adicionarOutroTrecho() {
    const payload = montarPayloadConfirmacao();
    if (!payload) return;
    confirmarItemAtual(payload);
    router.push("/novo-orcamento/step-2-escopo");
  }

  async function irParaRevisao() {
    const payload = montarPayloadConfirmacao();
    if (!payload || !config) return;

    setErro(null);
    setSalvando("revisao");
    try {
      confirmarItemAtual(payload);
      const todosOsItens = useWizardStore.getState().itens;

      const valorMateriaisTotal = Number(
        todosOsItens.reduce((acc, i) => acc + i.precificacao.subtotal_material, 0).toFixed(2)
      );

      const calcInput: CalcularOrcamentoInput = {
        valor_materiais_direto: valorMateriaisTotal,
        config,
        impostosExtras,
        horas_mao_obra: horasMaoObraTotal(todosOsItens),
        km_deslocamento: custosOperacionais.km_deslocamento,
        noites_hospedagem: custosOperacionais.noites_hospedagem,
        toneladas_frete: custosOperacionais.toneladas_frete,
        desconto_percentual_extra: custosOperacionais.desconto_percentual_extra ?? undefined,
      };

      const resposta = await fetch("/api/calcular-orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calcInput),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.error ?? "Erro ao calcular o orçamento.");
        return;
      }

      setResultadoOrcamento(dados);
      router.push("/novo-orcamento/step-5-revisao");
    } finally {
      setSalvando(null);
    }
  }

  const espessuraExibida =
    especificacoes.tipo_trabalho === "quente"
      ? especificacoes.espessura_mm
      : resultadoTermicoFrioAtual?.espessura_minima_mm ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">4. Preços {itens.length > 0 && `— trecho ${itens.length + 1}`}</h1>
        <p className="text-sm text-gray-500">
          Preços de materiais vêm do catálogo de{" "}
          <a href="/config-precos" className="text-brand hover:underline">
            Configuração de Preços
          </a>
          . Você pode ajustar o valor só para este orçamento sem alterar o catálogo.
        </p>
      </div>

      {!temResultado && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Volte ao passo anterior e calcule as especificações deste trecho.
        </p>
      )}

      {temResultado && (
        <>
          <div className="card space-y-1 text-sm">
            <h2 className="mb-2 text-lg font-semibold">Resumo técnico</h2>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <p>Material: {precoIsolante?.descricao ?? "—"}</p>
              <p>Acabamento: {precoAcabamento?.descricao ?? "—"}</p>
              <p>Metragem: {formatarNumero(metragem, 2)} m²</p>
              {espessuraExibida != null && <p>Espessura: {formatarNumero(espessuraExibida, 1)} mm</p>}
              {resultadoTermicoQuenteAtual?.financeiro && (
                <p>Economia anual estimada: {formatarMoeda(resultadoTermicoQuenteAtual.financeiro.economia_anual)}</p>
              )}
              {resultadoTermicoFrioAtual && (
                <p>Ponto de orvalho: {formatarNumero(resultadoTermicoFrioAtual.temperatura_orvalho, 1)} °C</p>
              )}
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Preços deste trecho</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">{precoIsolante?.descricao ?? "Isolante"} (R$/m²)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={valorIsolanteM2}
                  onChange={(e) => setPrecoIsolanteOverride(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label-field">{precoAcabamento?.descricao ?? "Acabamento"} (R$/m²)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={valorAcabamentoM2}
                  onChange={(e) => setPrecoAcabamentoOverride(Number(e.target.value))}
                />
              </div>
            </div>

            {precificacao && config && (
              <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
                <Linha label={`Isolante: ${formatarNumero(metragem, 2)} m² × ${formatarMoeda(valorIsolanteM2)}/m²`} valor={metragem * valorIsolanteM2} />
                <Linha label={`Acabamento: ${formatarNumero(metragem, 2)} m² × ${formatarMoeda(valorAcabamentoM2)}/m²`} valor={metragem * valorAcabamentoM2} />
                <Linha
                  label={`Mão de obra: ${formatarNumero(especificacoes.horas_mao_obra, 1)}h × ${formatarMoeda(config.valor_hora_mao_obra)}/h`}
                  valor={precificacao.subtotal_mao_obra}
                />
                <Linha label="Subtotal deste trecho" valor={precificacao.subtotal_trecho} destaque />
              </div>
            )}
          </div>
        </>
      )}

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-3-especificacoes")}>
          ← Voltar
        </button>
        <div className="flex gap-3">
          <button type="button" className="btn-accent" disabled={!precificacao || salvando !== null} onClick={adicionarOutroTrecho}>
            + Adicionar outro trecho
          </button>
          <button type="button" className="btn-primary" disabled={!precificacao || salvando !== null} onClick={irParaRevisao}>
            {salvando === "revisao" ? "Calculando..." : "Ir para Revisão →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Linha({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`flex justify-between ${destaque ? "border-t border-gray-200 pt-2 font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{formatarMoeda(valor)}</span>
    </div>
  );
}
