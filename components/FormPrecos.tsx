"use client";

import { useState } from "react";
import type { PrecoConfig } from "@/lib/types";

interface Props {
  precos: PrecoConfig[];
  onSalvar: (precos: PrecoConfig[]) => Promise<void>;
}

export default function FormPrecos({ precos, onSalvar }: Props) {
  const [itens, setItens] = useState<PrecoConfig[]>(precos);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  function atualizarCampo(id: number, campo: keyof PrecoConfig, valor: number | boolean) {
    setItens((prev) => prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)));
  }

  async function salvar() {
    setSalvando(true);
    setMensagem(null);
    try {
      await onSalvar(itens);
      setMensagem("Preços atualizados com sucesso.");
    } catch {
      setMensagem("Erro ao salvar preços.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold">Preços de materiais</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="table-header">
            <tr>
              <th className="py-2 pr-4">Material</th>
              <th className="py-2 pr-4">Preço unitário (R$)</th>
              <th className="py-2 pr-4">Densidade (kg/m³)</th>
              <th className="py-2 pr-4">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {itens.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-4">{item.descricao}</td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    step="0.01"
                    className="input-field w-32"
                    value={item.preco_unitario}
                    onChange={(e) => atualizarCampo(item.id, "preco_unitario", Number(e.target.value))}
                  />
                </td>
                <td className="py-2 pr-4">
                  {item.densidade_kg_m3 !== null ? (
                    <input
                      type="number"
                      step="1"
                      className="input-field w-28"
                      value={item.densidade_kg_m3}
                      onChange={(e) => atualizarCampo(item.id, "densidade_kg_m3", Number(e.target.value))}
                    />
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="checkbox"
                    checked={item.ativo}
                    onChange={(e) => atualizarCampo(item.id, "ativo", e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar preços"}
        </button>
        {mensagem && <span className="text-sm text-gray-500">{mensagem}</span>}
      </div>
    </div>
  );
}
