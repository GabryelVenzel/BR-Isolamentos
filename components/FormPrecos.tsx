"use client";

import { Fragment, useState } from "react";
import type { PrecoConfig, TipoMaterialPreco } from "@/lib/types";

interface Props {
  precos: PrecoConfig[];
  onSalvar: (precos: PrecoConfig[]) => Promise<void>;
}

// Grupos individuais (um cabeçalho por tipo) — chaparia e isolante continuam
// separados por tipo/família, cada um com sua própria seção. "Materiais
// Adicionais" é diferente: os 4 tipos `acessorio_*` são combinados numa
// ÚNICA seção (ver `chaveGrupo`/`LABEL_GRUPO["acessorio"]` abaixo) — pedido
// explícito, não faz sentido um cabeçalho por item ali.
const LABEL_GRUPO: Record<string, string> = {
  chaparia_aluminio: "Chaparia Alumínio",
  chaparia_galvanizado: "Chaparia Galvanizada",
  chaparia_inox: "Chaparia Inox",
  isolante_la_rocha: "Isolante — Lã de Rocha",
  isolante_fibra_ceramica: "Isolante — Fibra Cerâmica",
  isolante_espuma: "Isolante — Espuma Elastomérica",
  acessorio: "Materiais Adicionais",
};

// Ordem fixa das seções na tela (não é a ordem alfabética de `tipo_material`
// que viria da API) — chaparias por tipo, depois isolantes, Materiais
// Adicionais por último (migração 017).
const ORDEM_GRUPOS = [
  "chaparia_aluminio",
  "chaparia_galvanizado",
  "chaparia_inox",
  "isolante_la_rocha",
  "isolante_fibra_ceramica",
  "isolante_espuma",
  "acessorio",
];

/** Chaparia/isolante viram grupo por `tipo_material` (uma seção por tipo);
 * qualquer `acessorio_*` vira o grupo combinado "acessorio". */
function chaveGrupo(tipo: TipoMaterialPreco): string {
  return tipo.startsWith("acessorio_") ? "acessorio" : tipo;
}

/** Catálogo comercial (migração 010) — chaparia (Inox/Galvanizado/Alumínio)
 * e isolante (Fibra Cerâmica/Lã de Rocha/Espuma), preço por m², cada
 * espessura/densidade em ordem crescente (`ordem`, migração 017). "Materiais
 * Adicionais" (Arame/Parafusos/Rebite/Silicone, migrações 016/017) usa
 * unidade própria (kg/centena/frasco — ver `item.unidade`), por isso a
 * coluna de preço mostra a unidade de cada linha em vez de um cabeçalho fixo
 * "R$/m²". */
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

  const grupos = Array.from(new Set(itens.map((i) => chaveGrupo(i.tipo_material)))).sort((a, b) => {
    const posA = ORDEM_GRUPOS.indexOf(a);
    const posB = ORDEM_GRUPOS.indexOf(b);
    if (posA === -1 && posB === -1) return a.localeCompare(b);
    if (posA === -1) return 1;
    if (posB === -1) return -1;
    return posA - posB;
  });

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Preços de materiais</h2>
        <p className="text-sm text-gray-500">Isolante e chaparia (preço por m²) + materiais adicionais (arame, parafusos, silicone — preço por unidade própria).</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="table-header">
            <tr>
              <th className="py-2 pr-4">Material</th>
              <th className="py-2 pr-4">Especificação</th>
              <th className="py-2 pr-4">Preço</th>
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
                  .filter((item) => chaveGrupo(item.tipo_material) === grupo)
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-4">{item.descricao}</td>
                      <td className="py-2 pr-4 text-gray-500">{item.especificacao ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            className="input-field w-28"
                            value={item.preco_unitario}
                            onChange={(e) => atualizarCampo(item.id, "preco_unitario", Number(e.target.value))}
                          />
                          <span className="text-xs text-gray-400">/ {item.unidade === "m2" ? "m²" : item.unidade}</span>
                        </div>
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
