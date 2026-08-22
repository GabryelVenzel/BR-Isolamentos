"use client";

import { useState } from "react";
import type { TipoLancamentoFinanceiro } from "@/lib/types/domain";

interface Props {
  onCriado: () => void;
  onFechar: () => void;
}

export default function NovoLancamentoModal({ onCriado, onFechar }: Props) {
  const [tipo, setTipo] = useState<TipoLancamentoFinanceiro>("despesa");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [pago, setPago] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!categoria.trim() || !descricao.trim() || !valor) {
      setErro("Preencha categoria, descrição e valor.");
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const response = await fetch("/api/financeiro/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          categoria,
          descricao,
          valor: Number(valor),
          data,
          pago,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao criar lançamento.");
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
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">Novo Lançamento</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              className={tipo === "receita" ? "btn-accent" : "btn-secondary"}
              onClick={() => setTipo("receita")}
            >
              Receita
            </button>
            <button
              type="button"
              className={tipo === "despesa" ? "btn-danger" : "btn-secondary"}
              onClick={() => setTipo("despesa")}
            >
              Despesa
            </button>
          </div>

          <div>
            <label className="label-field">Categoria</label>
            <input className="input-field" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Materiais, salário, venda..." />
          </div>
          <div>
            <label className="label-field">Descrição</label>
            <input className="input-field" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Valor (R$)</label>
              <input type="number" step="0.01" className="input-field" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div>
              <label className="label-field">Data</label>
              <input type="date" className="input-field" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
            Já pago/recebido
          </label>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Criar lançamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
