"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

export interface FiltroAtivo {
  label: string;
  /** Limpa só este filtro. */
  limpar: () => void;
}

interface Props {
  /** Filtros aplicados agora — viram etiquetas removíveis e a contagem do botão. */
  ativos?: FiltroAtivo[];
  /** Campo de busca: fica sempre visível, fora do painel. */
  busca?: React.ReactNode;
  /** Os demais filtros (selects, marcações). */
  children: React.ReactNode;
}

/** Filtros de uma listagem (revisão de usabilidade). No computador ficam
 * abertos, numa faixa compacta. No celular a busca fica visível e o resto
 * vira o botão "Filtros (N)", que abre o painel — antes os filtros ocupavam
 * a primeira tela inteira. Os filtros ativos aparecem como etiquetas, cada
 * uma com X para limpar. */
export default function PainelFiltros({ ativos = [], busca, children }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        {busca && <div className="min-w-0 flex-1">{busca}</div>}
        <button
          type="button"
          className={`btn-secondary shrink-0 px-3 md:hidden ${ativos.length > 0 ? "border-brand" : ""}`}
          aria-expanded={aberto}
          onClick={() => setAberto((a) => !a)}
        >
          <SlidersHorizontal className="icone mr-1" aria-hidden />
          Filtros{ativos.length > 0 ? ` (${ativos.length})` : ""}
        </button>
      </div>
      <div className={`${aberto ? "block" : "hidden"} md:block`}>{children}</div>
      {ativos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ativos.map((f) => (
            <button
              key={f.label}
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand hover:bg-brand-light/70"
              onClick={f.limpar}
              aria-label={`Remover filtro ${f.label}`}
            >
              {f.label}
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
