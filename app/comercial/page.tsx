"use client";

import { useCallback, useEffect, useState } from "react";
import LeadCard from "@/components/comercial/LeadCard";
import NovoLeadModal from "@/components/comercial/NovoLeadModal";
import { formatarEtapa, formatarMoeda } from "@/lib/format";
import type { EtapaFunil, Lead } from "@/lib/types/domain";

// Ordem de exibição das colunas — "perdido" fica por último e mais discreta
// (ver classesColuna abaixo), já que é uma etapa terminal "de saída", não
// parte do fluxo principal do funil.
const ETAPAS: EtapaFunil[] = ["prospeccao", "contato", "proposta", "negociacao", "fechado", "perdido"];

function classesColuna(etapa: EtapaFunil): string {
  return etapa === "perdido" ? "bg-gray-100" : "bg-brand-light/60";
}

export default function ComercialPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch("/api/comercial/leads");
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao carregar leads.");
        return;
      }
      setLeads(payload.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const valorTotalAtivo = leads
    .filter((l) => l.etapa !== "fechado" && l.etapa !== "perdido")
    .reduce((acc, l) => acc + l.valor_estimado, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Comercial</h1>
          <p className="text-sm text-gray-500">
            Funil de vendas — {leads.length} lead{leads.length === 1 ? "" : "s"}, {formatarMoeda(valorTotalAtivo)} em
            negociação ativa.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setMostrarNovo(true)}>
          + Novo Lead
        </button>
      </div>

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {ETAPAS.map((etapa) => {
            const leadsDaEtapa = leads.filter((l) => l.etapa === etapa);
            return (
              <div key={etapa} className={`rounded-card p-3 ${classesColuna(etapa)}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-montserrat text-sm font-bold text-brand">{formatarEtapa(etapa)}</h2>
                  <span className="badge bg-secondary-light text-brand">{leadsDaEtapa.length}</span>
                </div>
                <div className="space-y-2">
                  {leadsDaEtapa.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                  {leadsDaEtapa.length === 0 && <p className="text-xs text-gray-400">Nenhum lead nesta etapa.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mostrarNovo && (
        <NovoLeadModal
          onFechar={() => setMostrarNovo(false)}
          onCriado={() => {
            setMostrarNovo(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
