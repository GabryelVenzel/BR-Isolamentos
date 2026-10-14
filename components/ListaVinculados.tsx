"use client";

import Link from "next/link";

export interface ItemVinculado {
  id: string;
  href?: string;
  titulo: React.ReactNode;
  detalhe?: React.ReactNode;
  direita?: React.ReactNode;
}

/** Lista simples de registros ligados a uma ficha (obras do parceiro,
 * lançamentos do fornecedor, leads do cliente...) — cada linha abre o
 * registro. */
export default function ListaVinculados({ titulo, itens, vazio }: { titulo: string; itens: ItemVinculado[] | null; vazio: string }) {
  return (
    <section className="card space-y-2">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {itens === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-input bg-gray-100" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-gray-400">{vazio}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {itens.map((item) => {
            const conteudo = (
              <span className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-800">{item.titulo}</span>
                  {item.detalhe && <span className="block truncate text-xs text-gray-500">{item.detalhe}</span>}
                </span>
                {item.direita && <span className="shrink-0 text-sm">{item.direita}</span>}
              </span>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="block rounded-input px-1 hover:bg-gray-50">
                    {conteudo}
                  </Link>
                ) : (
                  conteudo
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
