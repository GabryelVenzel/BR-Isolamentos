"use client";

import { useState, type DragEvent } from "react";
import ServicoCard from "./ServicoCard";
import type { EtapaServico, Servico } from "@/lib/types/domain";

const ETAPAS: EtapaServico[] = ["planejamento", "execucao", "finalizado"];
const LABEL_ETAPA: Record<EtapaServico, string> = {
  planejamento: "Planejamento",
  execucao: "Execução",
  finalizado: "Finalizado",
};
// Planejamento = azul, execução = verde, finalizado = cinza (regra do
// pedido pra cores do Kanban).
const CLASSES_COLUNA: Record<EtapaServico, string> = {
  planejamento: "bg-brand-light/60",
  execucao: "bg-accent-light/60",
  finalizado: "bg-gray-100",
};
const OPCOES_MOVER = ETAPAS.map((etapa) => ({ valor: etapa, label: LABEL_ETAPA[etapa] }));

interface Props {
  servicos: Servico[];
  onAbrirServico: (servico: Servico) => void;
  onMoverServico: (servicoId: string, novaEtapa: EtapaServico) => void;
  /** Arrastar pra "Finalizado" não move direto — abre o checklist de
   * finalização no modal de detalhes (ver app/operacional/servicos/page.tsx). */
  onSoltarEmFinalizado: (servicoId: string) => void;
}

export default function KanbanServicos({ servicos, onAbrirServico, onMoverServico, onSoltarEmFinalizado }: Props) {
  const [servicoArrastando, setServicoArrastando] = useState<string | null>(null);
  const [colunaEmFoco, setColunaEmFoco] = useState<EtapaServico | null>(null);

  function soltarEm(e: DragEvent<HTMLDivElement>, etapa: EtapaServico) {
    e.preventDefault();
    const servicoId = e.dataTransfer.getData("text/plain");
    if (servicoId) {
      if (etapa === "finalizado") onSoltarEmFinalizado(servicoId);
      else onMoverServico(servicoId, etapa);
    }
    setServicoArrastando(null);
    setColunaEmFoco(null);
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:snap-none sm:px-0">
      {ETAPAS.map((etapa) => {
        const servicosDaEtapa = servicos.filter((s) => s.etapa === etapa);

        return (
          <div
            key={etapa}
            className={`flex max-h-[calc(100vh-14rem)] min-h-[12rem] w-[85vw] shrink-0 snap-center flex-col rounded-card p-3 transition-shadow sm:w-auto sm:min-w-[16rem] sm:flex-1 ${CLASSES_COLUNA[etapa]} ${
              colunaEmFoco === etapa ? "ring-2 ring-accent" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (colunaEmFoco !== etapa) setColunaEmFoco(etapa);
            }}
            onDragLeave={() => setColunaEmFoco((atual) => (atual === etapa ? null : atual))}
            onDrop={(e) => soltarEm(e, etapa)}
          >
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 className="font-montserrat text-sm font-bold text-brand">{LABEL_ETAPA[etapa]}</h2>
              <span className="badge bg-secondary-light text-brand">{servicosDaEtapa.length}</span>
            </div>
            <div className="-mr-1 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {servicosDaEtapa.map((servico) => (
                <ServicoCard
                  key={servico.id}
                  servico={servico}
                  opcoesMover={OPCOES_MOVER}
                  onMover={(destino) => (destino === "finalizado" ? onSoltarEmFinalizado(servico.id) : onMoverServico(servico.id, destino))}
                  onAbrir={onAbrirServico}
                  onIniciarArraste={setServicoArrastando}
                  onTerminarArraste={() => setServicoArrastando(null)}
                  arrastando={servicoArrastando === servico.id}
                />
              ))}
              {servicosDaEtapa.length === 0 && <p className="text-xs text-gray-400">Nenhum serviço nesta etapa.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
