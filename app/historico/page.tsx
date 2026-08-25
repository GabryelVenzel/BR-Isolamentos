"use client";

import { useCallback, useEffect, useState } from "react";
import TableOrcamentos from "@/components/TableOrcamentos";
import type { Orcamento, StatusOrcamento } from "@/lib/types";

const STATUS_OPCOES: Array<{ value: StatusOrcamento | ""; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "rascunho", label: "Rascunho" },
  { value: "proposta", label: "Proposta" },
  { value: "enviado", label: "Enviado" },
  { value: "aceito", label: "Aceito" },
  { value: "rejeitado", label: "Rejeitado" },
];

export default function HistoricoPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [status, setStatus] = useState<string>("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (dataInicio) params.set("data_inicio", dataInicio);
    if (dataFim) params.set("data_fim", dataFim);

    const response = await fetch(`/api/orcamentos?${params.toString()}`);
    if (response.ok) {
      const data: Orcamento[] = await response.json();
      const buscaNormalizada = busca.trim().toLowerCase();
      const filtrados = buscaNormalizada
        ? data.filter(
            (o) =>
              o.cliente?.nome?.toLowerCase().includes(buscaNormalizada) ||
              o.numero?.toLowerCase().includes(buscaNormalizada) ||
              o.numero_orcamento?.toLowerCase().includes(buscaNormalizada)
          )
        : data;
      setOrcamentos(filtrados);
    }
    setCarregando(false);
  }, [status, dataInicio, dataFim, busca]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(id: number) {
    if (!confirm("Excluir este orçamento? Esta ação não pode ser desfeita.")) return;
    const response = await fetch(`/api/orcamentos/${id}`, { method: "DELETE" });
    if (response.ok) {
      setOrcamentos((prev) => prev.filter((o) => o.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico de Orçamentos</h1>
        <p className="text-sm text-gray-500">Consulte, filtre e gerencie todos os orçamentos.</p>
      </div>

      <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label-field">Buscar</label>
          <input
            className="input-field"
            placeholder="Código (O00001, ORC-2026-0001) ou nome do cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field">Status</label>
          <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPCOES.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">De</label>
          <input
            type="date"
            className="input-field"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field">Até</label>
          <input
            type="date"
            className="input-field"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <TableOrcamentos orcamentos={orcamentos} onExcluir={excluir} />
      )}
    </div>
  );
}
