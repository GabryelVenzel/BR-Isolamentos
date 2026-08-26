"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { horasMaoObraTotal, useWizardStore } from "@/lib/store";
import { precificarTrecho, somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { CalcularOrcamentoInput, ConfigEmpresa, ImpostoConfig, PrecoConfig } from "@/lib/types";

/** Preço de um acessório do catálogo (migrações 016/017) pela sua
 * `tipo_material` — 0 se ainda não cadastrado em Configurar Preços. */
function precoAcessorio(precos: PrecoConfig[], tipo: string): number {
  return precos.find((p) => p.tipo_material === tipo)?.preco_unitario ?? 0;
}

/** Tela 4 (refatorada, migração 019) — Resumo técnico + Quantificação
 * automática de materiais/mão de obra + Custos operacionais (movidos da
 * Revisão pra cá — pedido explícito). Os "Cálculos" viraram automáticos
 * (tela anterior). Preços por m²/unidade são editáveis SÓ PARA ESTE
 * ORÇAMENTO (não altera o catálogo em Configurar Preços). */
export default function Step4PrecosPage() {
  const router = useRouter();
  const {
    itemAtual: especificacoes,
    escopoAtual,
    resultadoTermicoQuenteAtual,
    resultadoTermicoFrioAtual,
    itens,
    tipoProposta,
    custosOperacionais,
    setCustosOperacionais,
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

  const isolanteCustomizado = especificacoes.isolante_customizado_nome != null;
  const acabamentoCustomizado = especificacoes.acabamento_customizado_nome != null;

  const precoIsolanteCatalogo = precos.find((p) => p.id === especificacoes.preco_isolante_id);
  const precoAcabamentoCatalogo = precos.find((p) => p.id === especificacoes.preco_acabamento_id);

  const nomeIsolante = isolanteCustomizado ? especificacoes.isolante_customizado_nome! : precoIsolanteCatalogo?.descricao ?? "Isolante";
  const nomeAcabamento = acabamentoCustomizado ? especificacoes.acabamento_customizado_nome! : precoAcabamentoCatalogo?.descricao ?? "Acabamento";

  // Só bloqueia avançar por falta de resultado térmico quando NÃO é material
  // customizado (esses trechos pulam o cálculo térmico de propósito — ver
  // step-3-especificacoes/page.tsx).
  const materialCustomizado = isolanteCustomizado || acabamentoCustomizado;
  const temResultado = materialCustomizado || !!(resultadoTermicoQuenteAtual || resultadoTermicoFrioAtual);
  const metragem = especificacoes.metragem_editada ? especificacoes.metragem_manual_m2 ?? 0 : somarMetragemEscopo(escopoAtual);

  const valorIsolanteM2 =
    precoIsolanteOverride ?? (isolanteCustomizado ? especificacoes.isolante_customizado_preco_m2 ?? 0 : precoIsolanteCatalogo?.preco_unitario ?? 0);
  const valorAcabamentoM2 =
    precoAcabamentoOverride ?? (acabamentoCustomizado ? especificacoes.acabamento_customizado_preco_m2 ?? 0 : precoAcabamentoCatalogo?.preco_unitario ?? 0);

  const precosAcessorios = {
    rebiteUn: precoAcessorio(precos, "acessorio_rebite"),
    parafusoUn: precoAcessorio(precos, "acessorio_parafuso"),
    arameKg: precoAcessorio(precos, "acessorio_arame"),
    siliconeFrasco: precoAcessorio(precos, "acessorio_silicone"),
  };

  const precificacao =
    config && temResultado
      ? precificarTrecho({
          escopoItens: escopoAtual,
          tipoProposta,
          precoIsolanteM2: valorIsolanteM2,
          precoAcabamentoM2: valorAcabamentoM2,
          precosAcessorios,
          valorHoraMaoObra: config.valor_hora_mao_obra,
          trabalhoAltura: especificacoes.trabalho_altura,
          parametrosQuantificacao: config,
          parametrosMaoObra: config,
        })
      : null;

  function montarPayloadConfirmacao() {
    if (!precificacao) return null;
    return {
      materialNome: nomeIsolante,
      acabamentoNome: nomeAcabamento,
      especificacaoIsolante: isolanteCustomizado ? null : precoIsolanteCatalogo?.especificacao ?? null,
      especificacaoAcabamento: acabamentoCustomizado ? null : precoAcabamentoCatalogo?.especificacao ?? null,
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
              <p>Material: {nomeIsolante}</p>
              <p>Acabamento: {nomeAcabamento}</p>
              <p>Metragem: {formatarNumero(metragem, 2)} m²</p>
              {espessuraExibida != null && <p>Espessura: {formatarNumero(espessuraExibida, 1)} mm</p>}
              {resultadoTermicoQuenteAtual?.financeiro && (
                <p>Economia anual estimada: {formatarMoeda(resultadoTermicoQuenteAtual.financeiro.economia_anual)}</p>
              )}
              {resultadoTermicoFrioAtual && (
                <p>Ponto de orvalho: {formatarNumero(resultadoTermicoFrioAtual.temperatura_orvalho, 1)} °C</p>
              )}
              {materialCustomizado && (
                <p className="text-amber-600 sm:col-span-2">
                  ⚠️ Material customizado neste trecho — sem saídas técnicas (perda térmica/economia).
                </p>
              )}
            </div>
          </div>

          {tipoProposta === "somente_mo" ? (
            <div className="card rounded-lg bg-brand-light/40 p-4 text-sm text-brand">
              Proposta "Somente Mão de Obra" — quantificação/preço de material não entram neste orçamento.
            </div>
          ) : (
            <div className="card space-y-4">
              <h2 className="text-lg font-semibold">Quantificação de materiais</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-field">{nomeIsolante} (R$/m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={valorIsolanteM2}
                    onChange={(e) => setPrecoIsolanteOverride(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label-field">{nomeAcabamento} (R$/m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={valorAcabamentoM2}
                    onChange={(e) => setPrecoAcabamentoOverride(Number(e.target.value))}
                  />
                </div>
              </div>

              {precificacao && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="table-header">
                      <tr>
                        <th className="py-2 pr-4 text-left">Material</th>
                        <th className="py-2 pr-4 text-right">Qtd.</th>
                        <th className="py-2 pr-4 text-right">Preço unit.</th>
                        <th className="py-2 pr-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <LinhaQuantidade nome={nomeIsolante} qtd={precificacao.quantidades.isolanteM2} unidade="m²" precoUn={valorIsolanteM2} />
                      <LinhaQuantidade nome={nomeAcabamento} qtd={precificacao.quantidades.acabamentoM2} unidade="m²" precoUn={valorAcabamentoM2} />
                      <LinhaQuantidade nome="Rebite" qtd={precificacao.quantidades.rebiteUn} unidade="un." precoUn={precosAcessorios.rebiteUn} />
                      <LinhaQuantidade nome="Parafuso" qtd={precificacao.quantidades.parafusoUn} unidade="un." precoUn={precosAcessorios.parafusoUn} />
                      <LinhaQuantidade
                        nome="Arame"
                        qtd={precificacao.quantidades.arameGramas}
                        unidade="g"
                        precoUn={precosAcessorios.arameKg / 1000}
                      />
                      <LinhaQuantidade nome="Silicone" qtd={precificacao.quantidades.siliconeFrascos} unidade="frasco(s)" precoUn={precosAcessorios.siliconeFrasco} />
                    </tbody>
                  </table>
                  <p className="mt-1 text-xs text-gray-400">
                    Preços de Rebite/Parafuso/Arame/Silicone vêm do catálogo ("Materiais Adicionais" em Configurar
                    Preços) — ajuste lá se precisar mudar pra todos os orçamentos.
                  </p>
                </div>
              )}
            </div>
          )}

          {precificacao && config && (
            <div className="card space-y-1 text-sm">
              <h2 className="mb-2 text-lg font-semibold">Mão de obra (automática)</h2>
              <p className="text-xs text-gray-400">
                {formatarNumero(metragem, 2)} m² ÷ {formatarNumero(config.m2_por_hora_dupla, 2)} m²/h, eficiência{" "}
                {formatarNumero(precificacao.eficiencia_global * 100, 1)}%
                {especificacoes.trabalho_altura && " (inclui trabalho em altura)"}.
              </p>
              <Linha label={`${formatarNumero(precificacao.horas_mao_obra, 2)}h × ${formatarMoeda(config.valor_hora_mao_obra)}/h`} valor={precificacao.subtotal_mao_obra} />
              <Linha label="Subtotal deste trecho" valor={precificacao.subtotal_trecho} destaque />
            </div>
          )}

          {/* Custos operacionais: movidos da Revisão pra cá (pedido
              explícito) — valem pro orçamento inteiro, não só este trecho;
              o resumo financeiro final continua exibido na Revisão. */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Custos operacionais adicionais</h2>
            <p className="text-xs text-gray-400">Valem para o orçamento inteiro (todos os trechos juntos).</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label-field">Deslocamento (km)</label>
                <input
                  type="number"
                  className="input-field"
                  value={custosOperacionais.km_deslocamento}
                  onChange={(e) => setCustosOperacionais({ km_deslocamento: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Hospedagem (noites)</label>
                <input
                  type="number"
                  className="input-field"
                  value={custosOperacionais.noites_hospedagem}
                  onChange={(e) => setCustosOperacionais({ noites_hospedagem: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Frete (toneladas)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={custosOperacionais.toneladas_frete}
                  onChange={(e) => setCustosOperacionais({ toneladas_frete: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Desconto extra (%, opcional)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input-field"
                  placeholder="0"
                  value={custosOperacionais.desconto_percentual_extra ?? ""}
                  onChange={(e) => setCustosOperacionais({ desconto_percentual_extra: Number(e.target.value) })}
                />
              </div>
            </div>
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

function LinhaQuantidade({ nome, qtd, unidade, precoUn }: { nome: string; qtd: number; unidade: string; precoUn: number }) {
  return (
    <tr>
      <td className="py-1.5 pr-4">{nome}</td>
      <td className="py-1.5 pr-4 text-right text-gray-500">
        {formatarNumero(qtd, unidade === "g" ? 0 : 2)} {unidade}
      </td>
      <td className="py-1.5 pr-4 text-right text-gray-500">{formatarMoeda(precoUn)}</td>
      <td className="py-1.5 pr-4 text-right font-medium">{formatarMoeda(qtd * precoUn)}</td>
    </tr>
  );
}
