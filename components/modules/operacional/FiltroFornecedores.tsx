"use client";

import type { CategoriaFornecimento } from "@/lib/types/domain";

const TIPOS: Array<{ valor: CategoriaFornecimento; label: string }> = [
  { valor: "isolantes", label: "Isolantes" },
  { valor: "chaparia", label: "Chaparia" },
  { valor: "ferramentas", label: "Ferramentas" },
  { valor: "ferragens", label: "Ferragens" },
  { valor: "outros", label: "Outros" },
];

interface Props {
  value: CategoriaFornecimento[];
  onChange: (tipos: CategoriaFornecimento[]) => void;
}

/** Filtro por tipo de fornecimento na listagem de Fornecedores — múltipla
 * escolha (mostra quem tem PELO MENOS um dos tipos marcados), em tempo real
 * (sem botão de buscar, ver app/operacional/fornecedores/page.tsx). */
export default function FiltroFornecedores({ value, onChange }: Props) {
  function alternar(tipo: CategoriaFornecimento) {
    onChange(value.includes(tipo) ? value.filter((t) => t !== tipo) : [...value, tipo]);
  }

  return (
    <div className="card space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">Filtrar por tipo de fornecimento</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {TIPOS.map((t) => (
          <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={value.includes(t.valor)} onChange={() => alternar(t.valor)} />
            {t.label}
          </label>
        ))}
      </div>
      {value.length > 0 && (
        <button type="button" className="btn-secondary text-xs" onClick={() => onChange([])}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
