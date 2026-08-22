"use client";

import { useState } from "react";
import FormCliente from "@/components/FormCliente";
import type { Cliente } from "@/lib/types";
import type { TemperaturaLead } from "@/lib/types/domain";

interface Props {
  onCriado: () => void;
  onFechar: () => void;
}

/** Modal de criação de lead — reaproveita o mesmo `FormCliente` do wizard de
 * orçamento (busca cliente existente ou cadastra um novo). */
export default function NovoLeadModal({ onCriado, onFechar }: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [temperatura, setTemperatura] = useState<TemperaturaLead>("morno");
  const [valorEstimado, setValorEstimado] = useState("");
  const [origem, setOrigem] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [dataProximaAcao, setDataProximaAcao] = useState("");
  const [notas, setNotas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!cliente) {
      setErro("Selecione ou cadastre um cliente.");
      return;
    }
    setErro(null);
    setSalvando(true);

    try {
      const response = await fetch("/api/comercial/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: cliente.id,
          etapa: "prospeccao",
          temperatura,
          valor_estimado: valorEstimado ? Number(valorEstimado) : 0,
          origem: origem || null,
          proxima_acao: proximaAcao || null,
          data_proxima_acao: dataProximaAcao ? new Date(dataProximaAcao).toISOString() : null,
          notas: notas || null,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao criar lead.");
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
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">Novo Lead</h2>

        <div className="space-y-4">
          <FormCliente clienteSelecionado={cliente} onSelecionar={setCliente} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Temperatura</label>
              <select
                className="input-field"
                value={temperatura}
                onChange={(e) => setTemperatura(e.target.value as TemperaturaLead)}
              >
                <option value="frio">Frio</option>
                <option value="morno">Morno</option>
                <option value="quente">Quente</option>
              </select>
            </div>
            <div>
              <label className="label-field">Valor estimado (R$)</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={valorEstimado}
                onChange={(e) => setValorEstimado(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Origem</label>
              <input
                className="input-field"
                placeholder="Indicação, site, feira..."
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Próxima ação</label>
              <input
                className="input-field"
                placeholder="Ligar, enviar proposta..."
                value={proximaAcao}
                onChange={(e) => setProximaAcao(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Data da próxima ação</label>
              <input
                type="date"
                className="input-field"
                value={dataProximaAcao}
                onChange={(e) => setDataProximaAcao(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label-field">Notas</label>
            <textarea
              className="input-field"
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Criar lead"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
