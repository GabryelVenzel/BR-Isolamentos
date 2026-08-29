"use client";

import type { TipoTrabalhoOperacional } from "@/lib/types/domain";

interface Opcao {
  valor: TipoTrabalhoOperacional;
  label: string;
}

interface Props {
  value: TipoTrabalhoOperacional[];
  onChange: (valores: TipoTrabalhoOperacional[]) => void;
  options: Opcao[];
}

// Lista revisada (migração 027) — 6 categorias, no lugar das 4 antigas. `bancada`
// e `caldeiraria` preservam a chave antiga (só o rótulo de `caldeiraria`
// mudou); ver comentário em TipoTrabalhoOperacional (lib/types/domain.ts).
export const TIPOS_TRABALHO_OPCOES: Opcao[] = [
  { valor: "bancada", label: "Bancada" },
  { valor: "isolador", label: "Isolador" },
  { valor: "funileiro_tracador", label: "Funileiro Traçador" },
  { valor: "caldeiraria", label: "Caldeiraria (Fabricação)" },
  { valor: "removivel_montagem", label: "Removível (Montagem)" },
  { valor: "removivel_fabricacao", label: "Removível (Fabricação)" },
];

/** Multi-select de tipos de trabalho de um serviço — um serviço pode ter mais
 * de um tipo executado ao mesmo tempo (ex.: Caldeiraria + Isolamentos no
 * mesmo local/dia). Checkboxes simples em vez de um dropdown multi-select de
 * verdade: não precisa de nenhuma dependência nova, e a lista tem só 6
 * opções fixas — um dropdown custom seria complexidade sem ganho aqui. */
export default function MultiSelectTiposTrabalho({ value, onChange, options }: Props) {
  function alternar(valor: TipoTrabalhoOperacional) {
    onChange(value.includes(valor) ? value.filter((v) => v !== valor) : [...value, valor]);
  }

  return (
    <div className="flex flex-wrap gap-3 rounded-lg border border-gray-200 p-3">
      {options.map((opcao) => (
        <label key={opcao.valor} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.includes(opcao.valor)} onChange={() => alternar(opcao.valor)} />
          {opcao.label}
        </label>
      ))}
    </div>
  );
}
