"use client";

import { formatarMoeda } from "@/lib/format";
import { useOrcamentoCalculado } from "@/lib/hooks/useOrcamentoCalculado";
import type { PrecificacaoTrecho } from "@/lib/usecases/orcamento";

interface Props {
  /** Trecho ainda em edição (Tela 4) — entra na conta como se já estivesse
   * salvo, para o total acompanhar o que está sendo preenchido. */
  rascunho?: PrecificacaoTrecho | null;
}

/** Barra fixa no rodapé das etapas do orçamento: quanto o orçamento já soma,
 * com a equipe e os custos escolhidos até aqui. Some enquanto não há nenhum
 * trecho precificado. */
export default function BarraTotais({ rascunho }: Props) {
  const { trechos, maoObra, resultado, erro } = useOrcamentoCalculado(rascunho);
  if (trechos.length === 0) return null;

  return (
    <div className="sticky bottom-0 z-30 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur sm:mx-0 sm:rounded-t-card sm:border sm:px-5">
      {erro ? (
        <p className="text-sm text-status-error">{erro}</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-500">
            <span>
              {trechos.length} {trechos.length === 1 ? "trecho" : "trechos"}
              {rascunho ? " (com este)" : ""}
            </span>
            <span>
              Materiais <strong className="text-gray-800">{formatarMoeda(resultado?.valor_materiais ?? 0)}</strong>
            </span>
            <span>
              Execução <strong className="text-gray-800">{formatarMoeda(resultado?.valor_mao_obra ?? 0)}</strong>
              {maoObra && maoObra.dias > 0 && (
                <span className="text-xs">
                  {" "}
                  · {maoObra.pessoas} {maoObra.pessoas === 1 ? "pessoa" : "pessoas"}, {maoObra.dias} {maoObra.dias === 1 ? "dia" : "dias"}
                </span>
              )}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-montserrat text-xs font-bold uppercase text-brand">Total do orçamento</span>
            <span className="font-montserrat text-xl font-bold text-accent">{resultado ? formatarMoeda(resultado.valor_final) : "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
