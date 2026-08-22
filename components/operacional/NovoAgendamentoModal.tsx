"use client";

import { useEffect, useState } from "react";
import type { Orcamento } from "@/lib/types";
import type { Parceiro } from "@/lib/types/domain";

interface Props {
  parceiros: Parceiro[];
  onCriado: () => void;
  onFechar: () => void;
}

/** Modal de criação de agendamento — escolhe um orçamento (idealmente já
 * aceito) e um ou mais parceiros para a execução em campo. */
export default function NovoAgendamentoModal({ parceiros, onCriado, onFechar }: Props) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [orcamentoId, setOrcamentoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [parceirosSelecionados, setParceirosSelecionados] = useState<string[]>([]);
  const [local, setLocal] = useState("");
  const [horasEstimadas, setHorasEstimadas] = useState("");
  const [notas, setNotas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orcamentos?status=aceito")
      .then((r) => r.json())
      .then(setOrcamentos);
  }, []);

  function alternarParceiro(id: string) {
    setParceirosSelecionados((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function salvar() {
    if (!dataInicio) {
      setErro("Informe a data de início.");
      return;
    }
    setErro(null);
    setSalvando(true);

    try {
      const response = await fetch("/api/operacional/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orcamento_id: orcamentoId ? Number(orcamentoId) : null,
          data_inicio: dataInicio,
          data_fim: dataFim || null,
          parceiros_alocados: parceirosSelecionados,
          local: local || null,
          horas_estimadas: horasEstimadas ? Number(horasEstimadas) : null,
          notas: notas || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao criar agendamento.");
        return;
      }

      onCriado();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">Novo Agendamento</h2>

        <div className="space-y-4">
          <div>
            <label className="label-field">Orçamento</label>
            <select className="input-field" value={orcamentoId} onChange={(e) => setOrcamentoId(e.target.value)}>
              <option value="">Sem orçamento vinculado</option>
              {orcamentos.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.numero} — {o.cliente?.nome ?? "—"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Data de início *</label>
              <input type="date" className="input-field" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Data de fim</label>
              <input type="date" className="input-field" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Local</label>
              <input className="input-field" value={local} onChange={(e) => setLocal(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Horas estimadas</label>
              <input
                type="number"
                step="0.5"
                className="input-field"
                value={horasEstimadas}
                onChange={(e) => setHorasEstimadas(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label-field">Parceiros alocados</label>
            <div className="flex flex-wrap gap-2 rounded-input border border-[#CCCCCC] p-2">
              {parceiros.length === 0 && <p className="text-sm text-gray-400">Nenhum parceiro cadastrado.</p>}
              {parceiros.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => alternarParceiro(p.id)}
                  className={`badge ${
                    parceirosSelecionados.includes(p.id) ? "bg-accent text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">Notas</label>
            <textarea className="input-field" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Criar agendamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
