"use client";

import { useState, type DragEvent } from "react";
import LeadCardKanban from "./LeadCardKanban";
import { formatarEtapa, formatarMoeda } from "@/lib/format";
import { valorDoLead } from "@/lib/leads";
import type { EtapaFunil, Lead } from "@/lib/types/domain";

const ETAPAS_ATIVAS: EtapaFunil[] = ["prospeccao", "contato", "proposta", "negociacao", "fechado"];
const TODAS_ETAPAS: EtapaFunil[] = [...ETAPAS_ATIVAS, "perdido"];
const OPCOES_MOVER = TODAS_ETAPAS.map((etapa) => ({ valor: etapa, label: formatarEtapa(etapa) }));

function classesColuna(etapa: EtapaFunil, emFoco: boolean): string {
  const base = etapa === "perdido" ? "bg-gray-100" : "bg-brand-light/60";
  return emFoco ? `${base} ring-2 ring-accent` : base;
}

interface Props {
  leads: Lead[];
  onAbrirLead: (lead: Lead) => void;
  onMoverLead: (leadId: string, novaEtapa: EtapaFunil) => void;
  /** E-mail → nome dos responsáveis, pro cartão mostrar o nome. */
  nomesResponsaveis: Record<string, string>;
  /** "Perdido" fica fora do quadro por padrão (ver filtro "Mostrar
   * perdidos") — as 5 etapas ativas ganham o espaço. Pra marcar um lead como
   * perdido com a coluna oculta, usa-se o "Mover para..." do cartão. */
  mostrarPerdidos: boolean;
}

export default function KanbanBoard({ leads, onAbrirLead, onMoverLead, nomesResponsaveis, mostrarPerdidos }: Props) {
  const [leadArrastando, setLeadArrastando] = useState<string | null>(null);
  const [colunaEmFoco, setColunaEmFoco] = useState<EtapaFunil | null>(null);
  const etapas = mostrarPerdidos ? TODAS_ETAPAS : ETAPAS_ATIVAS;

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

  // Quadro em linha única com rolagem lateral: no celular cada coluna ocupa
  // quase a tela inteira e "encaixa" ao deslizar; no computador as colunas
  // dividem a largura. Cada coluna rola sozinha (cabeçalho fixo), em vez de a
  // página inteira crescer com a etapa mais cheia.
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:snap-none sm:px-0">
      {etapas.map((etapa) => {
        const leadsDaEtapa = leads.filter((l) => l.etapa === etapa);
        // Lead de comissão guarda o valor em `valor_comissao` (campo próprio,
        // não é uma venda com orçamento), não em `valor_estimado` — mesma
        // distinção que LeadCardKanban.tsx já faz pra decidir o que exibir no
        // card. Sem isso, a soma do topo da coluna ignorava esses leads
        // mesmo eles mostrando um valor certinho no próprio card.
        const valorEtapa = leadsDaEtapa.reduce((soma, l) => soma + valorDoLead(l), 0);

        return (
          <div
            key={etapa}
            className={`flex max-h-[calc(100vh-14rem)] min-h-[12rem] w-[85vw] shrink-0 snap-center flex-col rounded-card p-3 transition-shadow sm:w-auto sm:min-w-[15rem] sm:flex-1 ${classesColuna(etapa, colunaEmFoco === etapa)}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (colunaEmFoco !== etapa) setColunaEmFoco(etapa);
            }}
            onDragLeave={() => setColunaEmFoco((atual) => (atual === etapa ? null : atual))}
            onDrop={(e) => soltarEm(e, etapa)}
          >
            <div className="mb-2 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="font-montserrat text-sm font-bold text-brand">{formatarEtapa(etapa)}</h2>
                <span className="badge bg-secondary-light text-brand">{leadsDaEtapa.length}</span>
              </div>
              <p className="text-xs text-gray-500">{valorEtapa > 0 ? formatarMoeda(valorEtapa) : " "}</p>
            </div>
            <div className="-mr-1 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {leadsDaEtapa.map((lead) => (
                <LeadCardKanban
                  key={lead.id}
                  lead={lead}
                  nomeResponsavel={lead.atribuido_a ? nomesResponsaveis[lead.atribuido_a] ?? lead.atribuido_a : null}
                  opcoesMover={OPCOES_MOVER}
                  onMover={(destino) => onMoverLead(lead.id, destino)}
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
