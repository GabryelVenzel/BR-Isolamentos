"use client";

import { Fragment, useState } from "react";
import type { PrecoConfig } from "@/lib/types";

interface Props {
  precos: PrecoConfig[];
  onSalvar: (precos: PrecoConfig[]) => Promise<void>;
}

const LABEL_GRUPO: Record<string, string> = {
  chaparia_inox: "Chaparia Inox",
  chaparia_galvanizado: "Chaparia Galvanizada",
  chaparia_aluminio: "Chaparia Alumínio",
  isolante_fibra_ceramica: "Isolante — Fibra Cerâmica",
  isolante_la_rocha: "Isolante — Lã de Rocha",
  isolante_espuma: "Isolante — Espuma Elastomérica",
};

/** Catálogo comercial por m² (migração 010) — chaparia (Inox/Galvanizado/
 * Alumínio) e isolante (Fibra Cerâmica/Lã de Rocha/Espuma), cada um com 3
 * variantes de espessura/densidade. Preço sempre em R$/m² — não existe mais
 * a opção "por kg" (Método Expert antigo, descontinuado — ver migração 010). */
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

  const grupos = Array.from(new Set(itens.map((i) => i.tipo_material)));

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Preços de materiais</h2>
        <p className="text-sm text-gray-500">Catálogo comercial por m² — isolante e chaparia. Sem detalhamento de fixadores/vedação.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="table-header">
            <tr>
              <th className="py-2 pr-4">Material</th>
              <th className="py-2 pr-4">Especificação</th>
              <th className="py-2 pr-4">Preço (R$/m²)</th>
              <th className="py-2 pr-4">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {grupos.map((grupo) => (
              <Fragment key={grupo}>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="py-1.5 pr-4 text-xs font-semibold uppercase text-brand">
                    {LABEL_GRUPO[grupo] ?? grupo}
                  </td>
                </tr>
                {itens
                  .filter((item) => item.tipo_material === grupo)
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-4">{item.descricao}</td>
                      <td className="py-2 pr-4 text-gray-500">{item.especificacao ?? "—"}</td>
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
                        <input
                          type="checkbox"
                          checked={item.ativo}
                          onChange={(e) => atualizarCampo(item.id, "ativo", e.target.checked)}
                        />
                      </td>
                    </tr>
                  ))}
              </Fragment>
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
