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

export const TIPOS_TRABALHO_OPCOES: Opcao[] = [
  { valor: "bancada", label: "Bancada" },
  { valor: "caldeiraria", label: "Caldeiraria" },
  { valor: "isolamentos_removiveis", label: "Isolamentos Removíveis" },
  { valor: "isolamentos_fixos", label: "Isolamentos Fixos" },
];

/** Multi-select de tipos de trabalho de um serviço — um serviço pode ter mais
 * de um tipo executado ao mesmo tempo (ex.: Caldeiraria + Isolamentos no
 * mesmo local/dia). Checkboxes simples em vez de um dropdown multi-select de
 * verdade: não precisa de nenhuma dependência nova, e a lista tem só 4
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
