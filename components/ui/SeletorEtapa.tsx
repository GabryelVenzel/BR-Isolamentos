"use client";

interface Props<T extends string> {
  etapas: Array<{ valor: T; label: string; quantidade: number }>;
  selecionada: T;
  onSelecionar: (etapa: T) => void;
}

/** Quadro (Kanban) no celular (revisão de usabilidade): uma etapa por vez,
 * escolhida nestas abas com a contagem de cada uma — antes as colunas
 * ficavam lado a lado e a primeira, mesmo vazia, ocupava a tela inteira. Só
 * aparece no celular; no computador o quadro continua com todas as colunas. */
export default function SeletorEtapa<T extends string>({ etapas, selecionada, onSelecionar }: Props<T>) {
  return (
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden" role="tablist" aria-label="Etapas">
      {etapas.map((e) => {
        const ativa = e.valor === selecionada;
        return (
          <button
            key={e.valor}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onSelecionar(e.valor)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
              ativa ? "border-brand bg-brand text-white" : e.quantidade === 0 ? "border-gray-200 bg-white text-gray-400" : "border-gray-300 bg-white text-gray-700"
            }`}
          >
            {e.label}
            <span className={`rounded-full px-1.5 text-xs ${ativa ? "bg-white/20" : "bg-gray-100"}`}>{e.quantidade}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Etapa a mostrar primeiro no celular: a escolhida, se ainda existir; senão a
 * primeira que tem itens. */
export function etapaInicial<T extends string>(etapas: Array<{ valor: T; quantidade: number }>, escolhida: T | null): T {
  if (escolhida && etapas.some((e) => e.valor === escolhida)) return escolhida;
  return (etapas.find((e) => e.quantidade > 0) ?? etapas[0]).valor;
}
