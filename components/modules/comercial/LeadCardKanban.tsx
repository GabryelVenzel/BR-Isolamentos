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
  const atrasado = lead.etapa_atrasada === true;
  // "Retorno de agendamento" não é uma coluna nova — é derivado dos campos
  // que reativarLeadFrio.ts já grava (temperatura "morno" vindo de "frio" é
  // uma assinatura única desse fluxo específico: nenhum outro caminho do
  // sistema faz essa combinação exata). Continua marcado até o responsável
  // mudar a temperatura de novo (aí deixa de ser "recém-retornado" de
  // verdade) — sem precisar de coluna/migração nova só pra esse indicador.
  const retornouDeAgendamento = lead.temperatura === "morno" && lead.temperatura_anterior === "frio";

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
      className={`cursor-grab rounded-card border bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover active:cursor-grabbing ${
        atrasado ? "border-status-error" : "border-gray-200"
      } ${arrastando ? "opacity-40" : ""}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {lead.numero_lead && <span className="font-montserrat text-[11px] font-bold text-gray-400">{lead.numero_lead}</span>}
        <span className={`badge shrink-0 ${classesTemperatura(lead.temperatura)}`}>
          {formatarTemperatura(lead.temperatura)}
        </span>
      </div>

      {retornouDeAgendamento && (
        <span className="badge mb-1 inline-block bg-secondary-light text-brand" title="Voltou de reativação agendada — não é um lead 100% novo.">
          🔄 Retorno de Agendamento
        </span>
      )}

      <p className="mb-1 font-montserrat text-sm font-semibold leading-tight text-brand">{lead.cliente?.nome ?? "—"}</p>

      {lead.valor_estimado > 0 && (
        <p className="mb-1.5 font-montserrat text-base font-bold text-accent">{formatarMoeda(lead.valor_estimado)}</p>
      )}

      <div className="space-y-0.5 border-t border-gray-100 pt-1.5">
        {lead.origem && <p className="truncate text-xs text-gray-500">📍 {lead.origem}</p>}
        {lead.atribuido_a && <p className="truncate text-xs text-gray-500">👤 {lead.atribuido_a}</p>}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <p className="text-xs text-gray-400">📅 {formatarData(lead.created_at)}</p>
          {lead.dias_na_etapa_atual !== undefined && (
            <p className={`text-xs font-medium ${atrasado ? "text-status-error" : "text-gray-400"}`}>
              {atrasado ? "⚠️ " : "⏱ "}
              {Math.floor(lead.dias_na_etapa_atual)}d nesta etapa
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
