"use client";

import { useCallback, useEffect, useState } from "react";
import NovoAgendamentoModal from "@/components/operacional/NovoAgendamentoModal";
import { classesStatusAgendamento, formatarData, formatarStatusAgendamento } from "@/lib/format";
import type { Agendamento, Parceiro, StatusAgendamento } from "@/lib/types/domain";

const PROXIMOS_STATUS: Record<StatusAgendamento, StatusAgendamento[]> = {
  agendado: ["em_progresso", "cancelado"],
  em_progresso: ["concluido", "cancelado"],
  concluido: [],
  cancelado: [],
};

export default function OperacionalPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [respAgenda, respParceiros] = await Promise.all([
        fetch("/api/operacional/agendamentos"),
        fetch("/api/operacional/parceiros?ativo=true"),
      ]);
      const [payloadAgenda, payloadParceiros] = await Promise.all([respAgenda.json(), respParceiros.json()]);

      if (!payloadAgenda.success) {
        setErro(payloadAgenda.error ?? "Erro ao carregar a agenda.");
        return;
      }
      setAgendamentos(payloadAgenda.data);
      if (payloadParceiros.success) setParceiros(payloadParceiros.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarStatus(id: string, status: StatusAgendamento) {
    const response = await fetch(`/api/operacional/agendamentos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();
    if (payload.success) {
      setAgendamentos((prev) => prev.map((a) => (a.id === id ? payload.data : a)));
    }
  }

  function nomeParceiro(id: string): string {
    return parceiros.find((p) => p.id === id)?.nome ?? "—";
  }

  const grupos = new Map<string, Agendamento[]>();
  for (const agendamento of agendamentos) {
    const chave = agendamento.data_inicio;
    grupos.set(chave, [...(grupos.get(chave) ?? []), agendamento]);
  }
  const datasOrdenadas = Array.from(grupos.keys()).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operacional</h1>
          <p className="text-sm text-gray-500">Agenda de execução em campo.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setMostrarNovo(true)}>
          + Novo Agendamento
        </button>
      </div>

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : datasOrdenadas.length === 0 ? (
        <div className="card text-center text-sm text-gray-500">Nenhum agendamento na agenda.</div>
      ) : (
        <div className="space-y-6">
          {datasOrdenadas.map((data) => (
            <div key={data}>
              <h2 className="mb-2 font-montserrat text-sm font-bold uppercase text-brand">{formatarData(data)}</h2>
              <div className="space-y-3">
                {(grupos.get(data) ?? []).map((agendamento) => (
                  <div key={agendamento.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-montserrat font-semibold text-brand">
                          {agendamento.orcamento
                            ? `${agendamento.orcamento.numero} — ${agendamento.orcamento.cliente?.nome ?? "—"}`
                            : "Sem orçamento vinculado"}
                        </p>
                        {agendamento.local && <p className="text-sm text-gray-500">{agendamento.local}</p>}
                        {agendamento.parceiros_alocados.length > 0 && (
                          <p className="mt-1 text-sm text-gray-600">
                            Parceiros: {agendamento.parceiros_alocados.map(nomeParceiro).join(", ")}
                          </p>
                        )}
                        {agendamento.horas_estimadas != null && (
                          <p className="text-xs text-gray-400">{agendamento.horas_estimadas}h estimadas</p>
                        )}
                        {agendamento.notas && <p className="mt-1 text-sm text-gray-600">{agendamento.notas}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`badge ${classesStatusAgendamento(agendamento.status)}`}>
                          {formatarStatusAgendamento(agendamento.status)}
                        </span>
                        <div className="flex gap-2">
                          {PROXIMOS_STATUS[agendamento.status].map((status) => (
                            <button
                              key={status}
                              type="button"
                              className={status === "cancelado" ? "btn-danger" : "btn-accent"}
                              onClick={() => mudarStatus(agendamento.id, status)}
                            >
                              {formatarStatusAgendamento(status)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarNovo && (
        <NovoAgendamentoModal
          parceiros={parceiros}
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
