"use client";

import { useCallback, useEffect, useState } from "react";
import { formatarMoeda } from "@/lib/format";
import type { CustoFixo } from "@/lib/types/domain";

export default function CustosFixosPage() {
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const response = await fetch("/api/financeiro/custos-fixos");
    const payload = await response.json();
    if (payload.success) setCustos(payload.data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarValor(custo: CustoFixo, novoValor: number) {
    setSalvandoId(custo.id);
    try {
      const response = await fetch(`/api/financeiro/custos-fixos/${custo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor_mensal: novoValor }),
      });
      const payload = await response.json();
      if (payload.success) setCustos((prev) => prev.map((c) => (c.id === custo.id ? payload.data : c)));
    } finally {
      setSalvandoId(null);
    }
  }

  async function alternarAtivo(custo: CustoFixo) {
    const response = await fetch(`/api/financeiro/custos-fixos/${custo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !custo.ativo }),
    });
    const payload = await response.json();
    if (payload.success) setCustos((prev) => prev.map((c) => (c.id === custo.id ? payload.data : c)));
  }

  const totalAtivo = custos.filter((c) => c.ativo).reduce((acc, c) => acc + c.valor_mensal, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Custos Fixos</h1>
        <p className="text-sm text-gray-500">Despesas recorrentes mensais — total ativo: {formatarMoeda(totalAtivo)}</p>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {custos.map((custo) => (
            <div key={custo.id} className="card space-y-2">
              <div className="flex items-start justify-between">
                <p className="font-montserrat font-semibold text-brand">{custo.descricao}</p>
                <button
                  type="button"
                  className={`badge ${custo.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-700"}`}
                  onClick={() => alternarAtivo(custo)}
                >
                  {custo.ativo ? "Ativo" : "Inativo"}
                </button>
              </div>
              <div>
                <label className="label-field">Valor mensal (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  defaultValue={custo.valor_mensal}
                  disabled={salvandoId === custo.id}
                  onBlur={(e) => {
                    const novoValor = Number(e.target.value);
                    if (novoValor !== custo.valor_mensal) salvarValor(custo, novoValor);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
