"use client";

import { formatarData, formatarMoeda } from "@/lib/format";
import type { Servico } from "@/lib/types/domain";

const LABEL_TIPO: Record<string, string> = {
  bancada: "Bancada",
  caldeiraria: "Caldeiraria",
  isolamentos_removiveis: "Isolamentos Removíveis",
  isolamentos_fixos: "Isolamentos Fixos",
};

interface Props {
  servico: Servico;
  onAbrir: (servico: Servico) => void;
  onIniciarArraste: (servicoId: string) => void;
  onTerminarArraste: () => void;
  arrastando: boolean;
}

/** Card de um serviço no Kanban — mesmo padrão de drag&drop nativo HTML5 do
 * módulo Comercial (ver components/modules/comercial/LeadCardKanban.tsx). */
export default function ServicoCard({ servico, onAbrir, onIniciarArraste, onTerminarArraste, arrastando }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", servico.id);
        e.dataTransfer.effectAllowed = "move";
        onIniciarArraste(servico.id);
      }}
      onDragEnd={onTerminarArraste}
      onClick={() => onAbrir(servico)}
      className={`cursor-grab rounded-card border border-gray-200 bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover active:cursor-grabbing ${
        arrastando ? "opacity-40" : ""
      }`}
    >
      <p className="font-montserrat text-sm font-bold text-brand">{servico.numero_servico}</p>
      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-400">
        {servico.numero_lead && <span>Lead: {servico.numero_lead}</span>}
        {servico.numero_orcamento && <span>Orç: {servico.numero_orcamento}</span>}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-gray-700">{servico.cliente?.nome ?? "—"}</p>
      {servico.valor_orcado != null && (
        <p className="font-montserrat text-sm font-bold text-accent">{formatarMoeda(servico.valor_orcado)}</p>
      )}
      {servico.tipo_trabalho && <p className="text-xs text-gray-500">{LABEL_TIPO[servico.tipo_trabalho]}</p>}
      {servico.data_inicio && (
        <p className="text-xs text-gray-400">
          {formatarData(servico.data_inicio)}
          {servico.data_fim_prevista && ` – ${formatarData(servico.data_fim_prevista)}`}
        </p>
      )}
      {servico.parceiro_principal && <p className="truncate text-xs text-gray-500">👷 {servico.parceiro_principal.nome}</p>}
      {servico.etapa === "finalizado" && <p className="mt-1 text-xs font-semibold text-accent">✅ Concluído</p>}
    </div>
  );
}
