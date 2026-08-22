"use client";

import { useState, type DragEvent } from "react";
import LeadCardKanban from "./LeadCardKanban";
import { formatarEtapa, formatarMoeda } from "@/lib/format";
import type { EtapaFunil, Lead } from "@/lib/types/domain";

const ETAPAS: EtapaFunil[] = ["prospeccao", "contato", "proposta", "negociacao", "fechado", "perdido"];

function classesColuna(etapa: EtapaFunil, emFoco: boolean): string {
  const base = etapa === "perdido" ? "bg-gray-100" : "bg-brand-light/60";
  return emFoco ? `${base} ring-2 ring-accent` : base;
}

interface Props {
  leads: Lead[];
  onAbrirLead: (lead: Lead) => void;
  onMoverLead: (leadId: string, novaEtapa: EtapaFunil) => void;
}

export default function KanbanBoard({ leads, onAbrirLead, onMoverLead }: Props) {
  const [leadArrastando, setLeadArrastando] = useState<string | null>(null);
  const [colunaEmFoco, setColunaEmFoco] = useState<EtapaFunil | null>(null);

  // O id do lead solto vem do próprio dataTransfer (fonte confiável, ver
  // LeadCardKanban.tsx#onDragStart), não do estado `leadArrastando` — que
  // existe só pro efeito visual (opacidade do card sendo arrastado) e pode
  // ficar dessincronizado se `onDragEnd` disparar antes de `onDrop` em
  // alguns navegadores.
  function soltarEm(e: DragEvent<HTMLDivElement>, etapa: EtapaFunil) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) onMoverLead(leadId, etapa);
    setLeadArrastando(null);
    setColunaEmFoco(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {ETAPAS.map((etapa) => {
        const leadsDaEtapa = leads.filter((l) => l.etapa === etapa);
        const valorEtapa = leadsDaEtapa.reduce((soma, l) => soma + l.valor_estimado, 0);

        return (
          <div
            key={etapa}
            className={`rounded-card p-3 transition-shadow ${classesColuna(etapa, colunaEmFoco === etapa)}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (colunaEmFoco !== etapa) setColunaEmFoco(etapa);
            }}
            onDragLeave={() => setColunaEmFoco((atual) => (atual === etapa ? null : atual))}
            onDrop={(e) => soltarEm(e, etapa)}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-montserrat text-sm font-bold text-brand">{formatarEtapa(etapa)}</h2>
              <span className="badge bg-secondary-light text-brand">{leadsDaEtapa.length}</span>
            </div>
            {valorEtapa > 0 && <p className="mb-2 text-xs text-gray-500">{formatarMoeda(valorEtapa)}</p>}
            <div className="space-y-2">
              {leadsDaEtapa.map((lead) => (
                <LeadCardKanban
                  key={lead.id}
                  lead={lead}
                  onAbrir={onAbrirLead}
                  onIniciarArraste={setLeadArrastando}
                  onTerminarArraste={() => setLeadArrastando(null)}
                  arrastando={leadArrastando === lead.id}
                />
              ))}
              {leadsDaEtapa.length === 0 && <p className="text-xs text-gray-400">Nenhum lead nesta etapa.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
