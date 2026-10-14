"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Abas de uma ficha em página própria (revisão de usabilidade) — a aba fica
 * no endereço (?aba=), então dá para voltar direto nela e mandar o link. */
export default function FichaAbas({ abas }: { abas: Array<{ valor: string; label: string }> }) {
  const pathname = usePathname();
  const busca = useSearchParams();
  const atual = busca.get("aba") ?? abas[0].valor;
  return (
    <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Seções da ficha">
      {abas.map((a, i) => (
        <Link
          key={a.valor}
          href={i === 0 ? pathname : `${pathname}?aba=${a.valor}`}
          replace
          scroll={false}
          aria-current={atual === a.valor ? "page" : undefined}
          className={`shrink-0 whitespace-nowrap rounded-t-lg px-4 py-2 font-montserrat text-sm font-semibold ${
            atual === a.valor ? "border-b-2 border-brand bg-brand-light text-brand" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}

export function useAbaAtual(padrao: string): string {
  return useSearchParams().get("aba") ?? padrao;
}
