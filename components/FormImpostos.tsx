"use client";

import { useState } from "react";
import type { ImpostoConfig } from "@/lib/types";

interface Props {
  impostos: ImpostoConfig[];
  onSalvar: (impostos: ImpostoConfig[]) => Promise<void>;
  onRemover: (id: number) => Promise<void>;
}

type RascunhoImposto = Omit<ImpostoConfig, "id"> & { id: number | null };

export default function FormImpostos({ impostos, onSalvar, onRemover }: Props) {
  const [itens, setItens] = useState<RascunhoImposto[]>(impostos);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  function atualizarCampo(index: number, campo: keyof ImpostoConfig, valor: string | number | boolean) {
    setItens((prev) => prev.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)));
  }

  function adicionarLinha() {
    setItens((prev) => [...prev, { id: null, nome: "", percentual: 0, ativo: true, ordem: prev.length }]);
  }

  async function remover(index: number) {
    const item = itens[index];
    setItens((prev) => prev.filter((_, i) => i !== index));
    if (item.id) await onRemover(item.id);
  }

  async function salvar() {
    setSalvando(true);
    setMensagem(null);
    try {
      await onSalvar(itens as ImpostoConfig[]);
      setMensagem("Impostos atualizados com sucesso.");
    } catch {
      setMensagem("Erro ao salvar impostos.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Impostos extras</h2>
        <p className="text-sm text-gray-500">
          Somados por cima do imposto "base" do regime tributário (ex.: DAS do Simples
          Nacional). Use para taxas opcionais como INSS retido em cessão de mão de obra.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="py-2 pr-4">Nome</th>
              <th className="py-2 pr-4">Percentual (%)</th>
              <th className="py-2 pr-4">Ativo</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {itens.map((item, index) => (
              <tr key={item.id ?? `novo-${index}`}>
                <td className="py-2 pr-4">
                  <input
                    className="input-field w-56"
                    value={item.nome}
                    onChange={(e) => atualizarCampo(index, "nome", e.target.value)}
                    placeholder="Ex: INSS retido"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    step="0.01"
                    className="input-field w-28"
                    value={item.percentual}
                    onChange={(e) => atualizarCampo(index, "percentual", Number(e.target.value))}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="checkbox"
                    checked={item.ativo}
                    onChange={(e) => atualizarCampo(index, "ativo", e.target.checked)}
                  />
                </td>
                <td className="py-2 pr-4">
                  <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => remover(index)}>
                    remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" className="text-sm text-accent hover:underline" onClick={adicionarLinha}>
          + Adicionar imposto
        </button>
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar impostos"}
        </button>
        {mensagem && <span className="text-sm text-gray-500">{mensagem}</span>}
      </div>
    </div>
  );
}
