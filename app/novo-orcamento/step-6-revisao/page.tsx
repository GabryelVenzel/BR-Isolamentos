"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { estadoParaSalvar, tipoTrabalhoAgregado, useWizardStore } from "@/lib/store";
import { LABEL_FUNCAO_MAO_OBRA, alocarValorFinalPorTrecho, descreverItemEscopo, geometriaRepresentativa } from "@/lib/usecases/orcamento";
import { useOrcamentoCalculado } from "@/lib/hooks/useOrcamentoCalculado";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { ItemOrcamento, Orcamento, StatusOrcamento } from "@/lib/types";
import { confirmar } from "@/components/ui/confirmar";

const STATUS_OPCOES: StatusOrcamento[] = ["rascunho", "proposta", "enviado", "aceito", "rejeitado"];

/** Etapa 6 — conferência final e geração da proposta. Quando o wizard está
 * EDITANDO um orçamento salvo (`edicao`, ver app/orcamento/[id]/editar),
 * salvar atualiza esse orçamento (trechos incluídos) em vez de criar outro. Não edita equipe nem
 * custos (isso é da etapa 5, "Equipe e custos"); mostra tudo já calculado —
 * o mesmo cálculo derivado usado pela barra de totais e pelas outras etapas
 * (lib/hooks/useOrcamentoCalculado.ts), então excluir um trecho aqui refaz
 * os dias de obra e o orçamento na hora, sem nada para "recalcular". */
export default function Step6RevisaoPage() {
  const router = useRouter();
  const {
    clienteSelecionado,
    tipoProposta,
    itens: itensSalvos,
    horasUteisDiaOverride,
    observacoes: observacoesAdicionais,
    setObservacoes: setObservacoesAdicionais,
    edicao,
    setStatusEdicao,
    editarItem,
    removerItem,
    reset,
  } = useWizardStore();
  const { trechos, maoObra: maoObraEquipe, resultado: resultadoOrcamento, erro: erroCalculo } = useOrcamentoCalculado();

  // Trechos com a mão de obra da equipe já repartida (horas e valor).
  const itens = itensSalvos.map((item, index) => ({ ...item, precificacao: trechos[index]?.precificacao ?? item.precificacao }));

  const [salvando, setSalvando] = useState<"rascunho" | "proposta" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const tipoTrabalho = itens.length > 0 ? tipoTrabalhoAgregado(itens) : null;
  const completo = clienteSelecionado && itens.length > 0 && resultadoOrcamento;

  async function excluirTrecho(index: number) {
    if (!(await confirmar("Excluir este trecho do orçamento?"))) return;
    removerItem(index);
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

  /** Orçamento novo: `status` é o do botão (rascunho/proposta). Em edição:
   * vale o status escolhido na tela — "gerar proposta" só promove um
   * rascunho a proposta, nunca rebaixa um orçamento já enviado/aceito. */
  async function salvar(statusBotao: Orcamento["status"], destino: "view" | "proposta") {
    if (!completo || !tipoTrabalho) return;
    setErro(null);
    setSalvando(destino === "view" ? "rascunho" : "proposta");
    const status = edicao ? (destino === "proposta" && edicao.status === "rascunho" ? "proposta" : edicao.status) : statusBotao;

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

          trabalho_altura: item.especificacoes.trabalho_altura,
          eficiencia_global: item.precificacao.eficiencia_global,

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
          detalhamento_materiais: item.precificacao.detalhamentoMateriais,

          valor_materiais: item.precificacao.subtotal_material,
        };
      });

      const payload = {
        cliente_id: clienteSelecionado!.id,
        tipo_trabalho: tipoTrabalho,
        tipo_proposta: tipoProposta,

        valor_materiais: resultadoOrcamento!.valor_materiais,
        valor_mao_obra: resultadoOrcamento!.valor_mao_obra,
        valor_deslocamento: resultadoOrcamento!.valor_deslocamento,
        valor_hospedagem: resultadoOrcamento!.valor_hospedagem,
        valor_frete: resultadoOrcamento!.valor_frete,
        valor_aluguel_carro: resultadoOrcamento!.valor_aluguel_carro,
        valor_alimentacao: resultadoOrcamento!.valor_alimentacao,
        horas_uteis_dia: horasUteisDiaOverride,
        mao_obra_equipe: maoObraEquipe,
        subtotal: resultadoOrcamento!.subtotal,
        detalhamento_impostos: resultadoOrcamento!.detalhamento_impostos,
        total_impostos: resultadoOrcamento!.total_impostos,
        margem_lucro: resultadoOrcamento!.margem_lucro,
        valor_desconto: resultadoOrcamento!.valor_desconto,
        preco_cheio: resultadoOrcamento!.preco_cheio,
        valor_final: resultadoOrcamento!.valor_final,

        status,
        itens: itensPayload,
        observacoes_adicionais: observacoesAdicionais.trim() || null,
        // Cópia do wizard, para "Editar" reabrir como foi montado (migração 049).
        wizard_estado: estadoParaSalvar(useWizardStore.getState()),
      };

      const response = await fetch(edicao ? `/api/orcamentos/${edicao.id}` : "/api/orcamentos", {
        method: edicao ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.error ?? "Erro ao salvar orçamento.");
        return;
      }

      const idSalvo = edicao?.id ?? data.id;
      reset();
      router.push(destino === "proposta" ? `/orcamento/${idSalvo}/download-pdf` : `/orcamento/${idSalvo}`);
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">6. Revisão</h1>
        <p className="text-sm text-gray-500">Confira trechos, equipe e valores antes de gerar a proposta.</p>
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

          <div className="space-y-1 text-sm">
            <p>Material: {item.materialNome}</p>
            {item.acabamentoNome && <p>Acabamento: {item.acabamentoNome}</p>}
            <p>Metragem: {formatarNumero(item.precificacao.metragem_m2, 2)} m²</p>
            <p>Mão de obra: {formatarNumero(item.precificacao.horas_mao_obra, 1)} h de obra da equipe</p>
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

      {/* Equipe e diárias — só leitura; quem edita é a etapa 5. */}
      {maoObraEquipe && (
        <div className="card space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Mão de obra — equipe e diárias</h2>
            <button type="button" className="text-brand hover:underline" onClick={() => router.push("/novo-orcamento/step-5-equipe")}>
              Alterar equipe e custos
            </button>
          </div>
          {maoObraEquipe.funcoes.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-4 py-2 text-amber-700">Nenhuma pessoa na equipe — o orçamento está sem mão de obra.</p>
          ) : (
            <>
              {maoObraEquipe.funcoes.map((f) => (
                <div key={f.funcao} className="flex justify-between gap-4">
                  <span>
                    {LABEL_FUNCAO_MAO_OBRA[f.funcao]}: {f.pessoas} × {f.diarias} {f.diarias === 1 ? "diária" : "diárias"} × {formatarMoeda(f.valor_diaria)}
                  </span>
                  <span>{formatarMoeda(f.subtotal)}</span>
                </div>
              ))}
              <p className="border-t border-gray-100 pt-2 text-gray-500">
                {formatarNumero(maoObraEquipe.horas_obra, 1)} h de obra ÷ {formatarNumero(maoObraEquipe.horas_uteis_dia, 1)} h úteis por dia ={" "}
                <strong className="text-gray-800">
                  {maoObraEquipe.dias} {maoObraEquipe.dias === 1 ? "dia" : "dias"} de obra
                </strong>
                {maoObraEquipe.dias_manual ? " (ajuste manual)" : ""} — é o prazo de execução que vai na proposta.
              </p>
            </>
          )}
        </div>
      )}

      {edicao && (
        <div className="card space-y-2">
          <h2 className="text-lg font-semibold">Status do orçamento</h2>
          <p className="text-xs text-gray-500">
            Enquanto o orçamento estiver vinculado a um lead (Comercial), o status muda sozinho conforme a etapa do lead. Só ajuste à
            mão se ele não estiver vinculado a nenhum lead.
          </p>
          <select className="input-field max-w-xs" value={edicao.status} onChange={(e) => setStatusEdicao(e.target.value as StatusOrcamento)}>
            {STATUS_OPCOES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Observações adicionais (opcional)</h2>
        <p className="text-xs text-gray-400">Aparece numa seção própria da Proposta Comercial, quando preenchida.</p>
        <textarea
          className="input-field h-24"
          value={observacoesAdicionais}
          onChange={(e) => setObservacoesAdicionais(e.target.value)}
          placeholder="Ex.: Cliente optou por isolante com melhor custo-benefício..."
        />
      </div>

      {resultadoOrcamento && (
        <div className="card space-y-2 text-sm">
          <h2 className="mb-2 text-lg font-semibold">Resumo financeiro do orçamento</h2>
          <Linha label="Valor materiais" valor={resultadoOrcamento.valor_materiais} />
          {/* "Execução" (não "Mão de obra") — pedido explícito: esse valor
              agora pode incluir itens adicionais de execução (ex.: andaime),
              não só horas trabalhadas, então o nome precisa refletir isso.
              O campo interno continua `valor_mao_obra` (só o rótulo mudou). */}
          <Linha label="Execução" valor={resultadoOrcamento.valor_mao_obra} />
          {/* Ordem pedida explicitamente — mesma ordem da Tela 4 (Custos
              Operacionais Adicionais). */}
          <Linha label="Alimentação" valor={resultadoOrcamento.valor_alimentacao} />
          <Linha label="Deslocamento" valor={resultadoOrcamento.valor_deslocamento} />
          <Linha label="Aluguel de carro" valor={resultadoOrcamento.valor_aluguel_carro} />
          <Linha label="Hospedagem" valor={resultadoOrcamento.valor_hospedagem} />
          <Linha label="Frete" valor={resultadoOrcamento.valor_frete} />
          <Linha label="Custo total" valor={resultadoOrcamento.subtotal} destaque />
          {resultadoOrcamento.detalhamento_impostos.map((imposto) => (
            <Linha key={imposto.nome} label={`${imposto.nome} (${imposto.percentual.toFixed(2)}%)`} valor={imposto.valor} />
          ))}
          <Linha label={`Margem de lucro (${resultadoOrcamento.percentual_margem.toFixed(2)}%)`} valor={resultadoOrcamento.margem_lucro} />
          {/* Desconto (etapa "Equipe e custos") — só aparece quando existe. */}
          {resultadoOrcamento.valor_desconto > 0 && (
            <>
              <Linha label="Preço cheio" valor={resultadoOrcamento.preco_cheio} />
              <Linha label="Desconto" valor={-resultadoOrcamento.valor_desconto} />
            </>
          )}
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
      {(erro ?? erroCalculo) && <p className="text-sm text-status-error">{erro ?? erroCalculo}</p>}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-5-equipe")}>
          ← Voltar
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            className="btn-accent"
            disabled={!completo || salvando !== null}
            onClick={() => salvar("rascunho", "view")}
          >
            {salvando === "rascunho" ? "Salvando..." : edicao ? "Salvar alterações" : "Salvar rascunho"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!completo || salvando !== null}
            onClick={() => salvar("proposta", "proposta")}
          >
            {salvando === "proposta" ? "Salvando..." : edicao ? "Salvar e gerar proposta →" : "Gerar Proposta PDF/Word →"}
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
