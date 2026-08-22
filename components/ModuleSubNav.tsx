"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ModuleSubNavItem {
  href: string;
  label: string;
}

interface Props {
  items: ModuleSubNavItem[];
}

/** Navegação secundária de um módulo (ex.: Agenda/Parceiros dentro de
 * Operacional) — pílulas logo abaixo da Navbar principal, nas páginas do
 * módulo. Complementa (não substitui) indicadores de fluxo interno como o do
 * wizard de orçamento (app/novo-orcamento/layout.tsx), que tem semântica de
 * progresso linear, diferente de "trocar de seção dentro do módulo". */
export default function ModuleSubNav({ items }: Props) {
  const pathname = usePathname();

  // Escolhe o item mais específico que combina com a rota atual (maior
  // href), não "todo item cujo href é prefixo" — senão, numa lista como
  // ["/operacional", "/operacional/parceiros"], os dois ficariam ativos ao
  // mesmo tempo em "/operacional/parceiros" (o segundo também começa com o
  // href do primeiro).
  const itemAtivo = items.reduce<ModuleSubNavItem | null>((melhor, item) => {
    const combina = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!combina) return melhor;
    if (!melhor || item.href.length > melhor.href.length) return item;
    return melhor;
  }, null);

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
      {items.map((item) => {
        const ativo = item === itemAtivo;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-4 py-1.5 font-montserrat text-sm font-semibold transition-colors ${
              ativo ? "bg-brand text-white" : "bg-brand-light text-brand hover:bg-brand/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
