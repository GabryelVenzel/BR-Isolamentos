"use client";

import { classesTemperatura, formatarData, formatarMoeda, formatarTemperatura } from "@/lib/format";
import type { Lead } from "@/lib/types/domain";

interface Props {
  lead: Lead;
  onAbrir: (lead: Lead) => void;
  onIniciarArraste: (leadId: string) => void;
  onTerminarArraste: () => void;
  arrastando: boolean;
}

/** Card de um lead dentro de uma coluna do Kanban — arrastável via HTML5
 * Drag and Drop nativo (sem dependência nova: `react-beautiful-dnd` está
 * descontinuada e `@dnd-kit` seria mais peso do que o necessário aqui, um
 * board simples de 6 colunas). O fallback pra quem não usa mouse/touch com
 * precisão é o dropdown de etapa dentro do LeadDetailModal — clicar no card
 * sempre funciona e abre o mesmo controle. */
export default function LeadCardKanban({ lead, onAbrir, onIniciarArraste, onTerminarArraste, arrastando }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        onIniciarArraste(lead.id);
      }}
      onDragEnd={onTerminarArraste}
      onClick={() => onAbrir(lead)}
      className={`cursor-grab rounded-card border border-gray-200 bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover active:cursor-grabbing ${
        arrastando ? "opacity-40" : ""
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="font-montserrat text-sm font-semibold text-brand">{lead.cliente?.nome ?? "—"}</p>
        <span className={`badge shrink-0 ${classesTemperatura(lead.temperatura)}`}>
          {formatarTemperatura(lead.temperatura)}
        </span>
      </div>
      {lead.valor_estimado > 0 && (
        <p className="font-montserrat text-sm font-bold text-accent">{formatarMoeda(lead.valor_estimado)}</p>
      )}
      {lead.origem && <p className="mt-1 truncate text-xs text-gray-500">📍 {lead.origem}</p>}
      {lead.atribuido_a && <p className="truncate text-xs text-gray-500">👤 {lead.atribuido_a}</p>}
      <p className="mt-1 text-xs text-gray-400">📅 {formatarData(lead.created_at)}</p>
    </div>
  );
}
