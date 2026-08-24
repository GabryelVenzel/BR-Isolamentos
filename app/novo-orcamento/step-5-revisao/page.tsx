"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { horasMaoObraTotal, tipoTrabalhoAgregado, useWizardStore, type WizardItem } from "@/lib/store";
import { alocarValorFinalPorTrecho, descreverItemEscopo, geometriaRepresentativa } from "@/lib/usecases/orcamento";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { CalcularOrcamentoInput, ConfigEmpresa, ImpostoConfig, ItemOrcamento, Orcamento } from "@/lib/types";

export default function Step5RevisaoPage() {
  const router = useRouter();
  const {
    clienteSelecionado,
    itens,
    resultadoOrcamento,
    custosOperacionais,
    setCustosOperacionais,
    setResultadoOrcamento,
    editarItem,
    removerItem,
    reset,
  } = useWizardStore();

  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [impostosExtras, setImpostosExtras] = useState<ImpostoConfig[]>([]);
  const [recalculando, setRecalculando] = useState(false);
  const [salvando, setSalvando] = useState<"rascunho" | "proposta" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/config-empresa").then((r) => r.json()), fetch("/api/impostos-config").then((r) => r.json())]).then(
      ([c, i]) => {
        setConfig(c);
        setImpostosExtras(i);
      }
    );
  }, []);

  const tipoTrabalho = itens.length > 0 ? tipoTrabalhoAgregado(itens) : null;
  const completo = clienteSelecionado && itens.length > 0 && resultadoOrcamento;

  const recalcular = useCallback(
    async (itensAtuais: WizardItem[], custos: typeof custosOperacionais) => {
      if (!config || itensAtuais.length === 0) return;
      setRecalculando(true);
      setErro(null);
      try {
        const valorMateriaisTotal = Number(
          itensAtuais.reduce((acc, i) => acc + i.precificacao.subtotal_material, 0).toFixed(2)
        );
        const calcInput: CalcularOrcamentoInput = {
          valor_materiais_direto: valorMateriaisTotal,
          config,
          impostosExtras,
          horas_mao_obra: horasMaoObraTotal(itensAtuais),
          km_deslocamento: custos.km_deslocamento,
          noites_hospedagem: custos.noites_hospedagem,
          toneladas_frete: custos.toneladas_frete,
          desconto_percentual_extra: custos.desconto_percentual_extra ?? undefined,
        };
        const resposta = await fetch("/api/calcular-orcamento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(calcInput),
        });
        const dados = await resposta.json();
        if (!resposta.ok) {
          setErro(dados.error ?? "Erro ao recalcular o orçamento.");
          return;
        }
        setResultadoOrcamento(dados);
      } finally {
        setRecalculando(false);
      }
    },
    [config, impostosExtras, setResultadoOrcamento]
  );

  function atualizarCustoOperacional(dados: Partial<typeof custosOperacionais>) {
    setCustosOperacionais(dados);
    const novoCustos = { ...custosOperacionais, ...dados };
    recalcular(itens, novoCustos);
  }

  function excluirTrecho(index: number) {
    if (!confirm("Excluir este trecho do orçamento?")) return;
    removerItem(index);
    const restantes = useWizardStore.getState().itens;
    if (restantes.length > 0) recalcular(restantes, custosOperacionais);
    else setResultadoOrcamento(null);
  }

  function editarTrecho(index: number) {
    editarItem(index);
    router.push("/novo-orcamento/step-2-escopo");
  }

  const valoresPorTrecho = resultadoOrcamento
    ? alocarValorFinalPorTrecho(
        itens.map((i) => ({ subtotal_material: i.precificacao.subtotal_material, subtotal_mao_obra: i.precificacao.subtotal_mao_obra })),
        resultadoOrcamento.valor_final
      )
    : [];

  async function salvar(status: Orcamento["status"], destino: "view" | "proposta") {
    if (!completo || !tipoTrabalho) return;
    setErro(null);
    setSalvando(status === "rascunho" ? "rascunho" : "proposta");

    try {
      const itensPayload: Array<Omit<ItemOrcamento, "id" | "orcamento_id">> = itens.map((item, index) => {
        const geom = geometriaRepresentativa(item.escopoItens);
        const espessuraNecessaria =
          item.especificacoes.tipo_trabalho === "quente"
            ? item.especificacoes.espessura_mm ?? 0
            : item.resultadoTermicoFrio?.espessura_minima_mm ?? 0;

        return {
          ordem: index,
          tipo_trabalho: item.especificacoes.tipo_trabalho,
          escopo_itens: item.escopoItens,
          material: item.materialNome,
          acabamento: item.acabamentoNome,
          especificacao_isolante: item.especificacaoIsolante,
          especificacao_acabamento: item.especificacaoAcabamento,
          // Já validado como preenchido antes de o trecho poder ser confirmado (step-3).
          temperatura_quente: item.especificacoes.temperatura_quente ?? 0,
          temperatura_ambiente: item.especificacoes.temperatura_ambiente ?? 0,
          umidade_relativa: item.especificacoes.tipo_trabalho === "frio" ? item.especificacoes.umidade_relativa : null,
          velocidade_vento: item.especificacoes.tipo_trabalho === "frio" ? item.especificacoes.velocidade_vento_ms : null,
          geometria: geom.geometria,
          diametro_mm: geom.diametro_mm,
          area_m2: item.precificacao.metragem_m2,
          perimetro_m: null,

          espessura_necessaria_mm: espessuraNecessaria,
          temperatura_face_fria: item.resultadoTermicoQuente?.temperatura_face_fria ?? null,
          perda_com_isolante: item.resultadoTermicoQuente?.perda_com_isolante_kw_m2 ?? 0,
          perda_sem_isolante: item.resultadoTermicoQuente?.perda_sem_isolante_kw_m2 ?? 0,
          economia_anual: item.resultadoTermicoQuente?.financeiro?.economia_anual ?? null,
          co2_ton_ano: item.resultadoTermicoQuente?.financeiro?.co2_ton_ano ?? null,

          manta_kg: null,
          chapa_kg: null,
          rebites: null,
          parafusos: null,
          arame_kg: null,
          vedacao_pu: null,
          vedacit_un: null,

          preco_isolante_m2: item.precificacao.preco_isolante_m2,
          preco_acabamento_m2: item.precificacao.preco_acabamento_m2,
          horas_mao_obra: item.precificacao.horas_mao_obra,
          subtotal_material: item.precificacao.subtotal_material,
          subtotal_mao_obra: item.precificacao.subtotal_mao_obra,

          valor_materiais: item.precificacao.subtotal_material,
        };
      });

      const payload = {
        cliente_id: clienteSelecionado!.id,
        tipo_trabalho: tipoTrabalho,

        valor_materiais: resultadoOrcamento!.valor_materiais,
        valor_mao_obra: resultadoOrcamento!.valor_mao_obra,
        valor_deslocamento: resultadoOrcamento!.valor_deslocamento,
        valor_hospedagem: resultadoOrcamento!.valor_hospedagem,
        valor_frete: resultadoOrcamento!.valor_frete,
        subtotal: resultadoOrcamento!.subtotal,
        detalhamento_impostos: resultadoOrcamento!.detalhamento_impostos,
        total_impostos: resultadoOrcamento!.total_impostos,
        margem_lucro: resultadoOrcamento!.margem_lucro,
        valor_desconto: resultadoOrcamento!.valor_desconto,
        preco_cheio: resultadoOrcamento!.preco_cheio,
        valor_final: resultadoOrcamento!.valor_final,

        status,
        itens: itensPayload,
      };

      const response = await fetch("/api/orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.error ?? "Erro ao salvar orçamento.");
        return;
      }

      reset();
      router.push(destino === "proposta" ? `/orcamento/${data.id}/download-pdf` : `/orcamento/${data.id}`);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">5. Revisão</h1>
        <p className="text-sm text-gray-500">Confira todos os trechos antes de gerar a proposta.</p>
      </div>

      <div className="card space-y-1 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Cliente</h2>
        <p>{clienteSelecionado?.nome ?? "—"}</p>
      </div>

      {tipoTrabalho && (
        <div className="rounded-lg bg-brand-light px-4 py-2 text-sm text-brand">
          Tipo de orçamento: <strong>{tipoTrabalho === "misto" ? "Misto (quente + frio)" : tipoTrabalho === "quente" ? "Quente" : "Frio"}</strong>
        </div>
      )}

      {itens.map((item, index) => (
        <div key={index} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Trecho {index + 1} — {item.especificacoes.tipo_trabalho === "quente" ? "Térmico Quente" : "Térmico Frio"}
            </h2>
            <div className="flex gap-3 text-sm">
              <button type="button" className="text-brand hover:underline" onClick={() => editarTrecho(index)}>
                Editar
              </button>
              <button type="button" className="text-status-error hover:underline" onClick={() => excluirTrecho(index)}>
                Excluir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            <p>Material: {item.materialNome}</p>
            {item.acabamentoNome && <p>Acabamento: {item.acabamentoNome}</p>}
            <p>Metragem: {formatarNumero(item.precificacao.metragem_m2, 2)} m²</p>
            <p>Mão de obra: {formatarNumero(item.especificacoes.horas_mao_obra, 1)}h</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Itens do Escopo</p>
            <ul className="space-y-0.5 text-sm text-gray-600">
              {item.escopoItens.map((escopo) => (
                <li key={escopo.id}>
                  • {escopo.nome} ({descreverItemEscopo(escopo)})
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1 border-t border-gray-100 pt-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal material</span>
              <span>{formatarMoeda(item.precificacao.subtotal_material)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal mão de obra</span>
              <span>{formatarMoeda(item.precificacao.subtotal_mao_obra)}</span>
            </div>
            {valoresPorTrecho[index] !== undefined && (
              <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
                <span>TOTAL TRECHO {index + 1} (com impostos/margem)</span>
                <span className="text-accent">{formatarMoeda(valoresPorTrecho[index])}</span>
              </div>
            )}
          </div>
        </div>
      ))}

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
              onChange={(e) => atualizarCustoOperacional({ km_deslocamento: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label-field">Hospedagem (noites)</label>
            <input
              type="number"
              className="input-field"
              value={custosOperacionais.noites_hospedagem}
              onChange={(e) => atualizarCustoOperacional({ noites_hospedagem: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label-field">Frete (toneladas)</label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              value={custosOperacionais.toneladas_frete}
              onChange={(e) => atualizarCustoOperacional({ toneladas_frete: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label-field">Desconto extra (%, opcional)</label>
            <input
              type="number"
              step="0.1"
              className="input-field"
              placeholder="usar padrão da empresa"
              value={custosOperacionais.desconto_percentual_extra ?? ""}
              onChange={(e) => atualizarCustoOperacional({ desconto_percentual_extra: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {resultadoOrcamento && (
        <div className="card space-y-2 text-sm">
          <h2 className="mb-2 text-lg font-semibold">Resumo financeiro do orçamento {recalculando && "(recalculando...)"}</h2>
          <Linha label="Valor materiais" valor={resultadoOrcamento.valor_materiais} />
          <Linha label="Mão de obra" valor={resultadoOrcamento.valor_mao_obra} />
          <Linha label="Deslocamento" valor={resultadoOrcamento.valor_deslocamento} />
          <Linha label="Hospedagem" valor={resultadoOrcamento.valor_hospedagem} />
          <Linha label="Frete" valor={resultadoOrcamento.valor_frete} />
          <Linha label="Custo total" valor={resultadoOrcamento.subtotal} destaque />
          {resultadoOrcamento.detalhamento_impostos.map((imposto) => (
            <Linha key={imposto.nome} label={`${imposto.nome} (${imposto.percentual.toFixed(2)}%)`} valor={imposto.valor} />
          ))}
          <Linha label={`Margem de lucro (${resultadoOrcamento.percentual_margem.toFixed(2)}%)`} valor={resultadoOrcamento.margem_lucro} />
          <Linha label="Desconto" valor={-resultadoOrcamento.valor_desconto} />
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
            <span>TOTAL ORÇAMENTO</span>
            <span className="text-accent">{formatarMoeda(resultadoOrcamento.valor_final)}</span>
          </div>
        </div>
      )}

      <div className="card flex justify-center">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-2-escopo")}>
          + Adicionar novo trecho
        </button>
      </div>

      {!completo && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Complete os passos anteriores antes de salvar o orçamento.
        </p>
      )}
      {erro && <p className="text-sm text-status-error">{erro}</p>}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-4-precos")}>
          ← Voltar
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            className="btn-accent"
            disabled={!completo || salvando !== null}
            onClick={() => salvar("rascunho", "view")}
          >
            {salvando === "rascunho" ? "Salvando..." : "Salvar rascunho"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!completo || salvando !== null}
            onClick={() => salvar("proposta", "proposta")}
          >
            {salvando === "proposta" ? "Salvando..." : "Gerar Proposta PDF/Word →"}
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
