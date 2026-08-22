"use client";

import { formatarDataHora, formatarMoeda } from "@/lib/format";
import type { AgendamentoLeadFrio } from "@/lib/types/domain";

interface Props {
  agendamentos: AgendamentoLeadFrio[];
  carregando: boolean;
  onReativar: (agendamentoId: string) => void;
  onCancelar: (agendamentoId: string) => void;
}

/** Substitui o Kanban principal quando o filtro "Mostrar leads frios em
 * reativação" está ativo (ver app/comercial/page.tsx) — não é mais uma
 * coluna do funil, é a fila de retorno programado. */
export default function LeadsFriosPanel({ agendamentos, carregando, onReativar, onCancelar }: Props) {
  if (carregando) return <p className="text-sm text-gray-500">Carregando leads frios...</p>;

  if (agendamentos.length === 0) {
    return (
      <div className="card text-center text-sm text-gray-500">Nenhum lead frio aguardando reativação no momento.</div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-montserrat text-sm font-bold uppercase text-brand">
        Leads Frios em Reativação ({agendamentos.length})
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agendamentos.map((agendamento) => (
          <div key={agendamento.id} className="card space-y-2 border-l-4 border-l-brand">
            <div className="flex items-start justify-between gap-2">
              <p className="font-montserrat text-sm font-semibold text-brand">{agendamento.lead?.cliente?.nome ?? "—"}</p>
              <span className="badge bg-brand-light text-brand">Frio</span>
            </div>
            {agendamento.lead && agendamento.lead.valor_estimado > 0 && (
              <p className="font-montserrat text-sm font-bold text-accent">{formatarMoeda(agendamento.lead.valor_estimado)}</p>
            )}
            <p className="text-xs text-gray-500">Retornar em: {formatarDataHora(agendamento.data_retorno)}</p>
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-accent flex-1 text-xs" onClick={() => onReativar(agendamento.id)}>
                Reativar agora
              </button>
              <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onCancelar(agendamento.id)}>
                Cancelar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
