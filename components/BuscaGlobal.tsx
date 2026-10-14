"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, ClipboardList, FileText, HardHat, Search, Truck, User, Users } from "lucide-react";
import type { ResultadoBusca, TipoResultadoBusca } from "@/lib/contexts/busca";
import { empilharModal } from "./ui/pilha-modais";

const ICONE: Record<TipoResultadoBusca, React.ReactNode> = {
  lead: <Users className="h-4 w-4" aria-hidden />,
  servico: <HardHat className="h-4 w-4" aria-hidden />,
  orcamento: <FileText className="h-4 w-4" aria-hidden />,
  cliente: <Building2 className="h-4 w-4" aria-hidden />,
  parceiro: <Briefcase className="h-4 w-4" aria-hidden />,
  fornecedor: <Truck className="h-4 w-4" aria-hidden />,
  funcionario: <User className="h-4 w-4" aria-hidden />,
};

/** Busca geral (revisão de usabilidade): botão no cabeçalho e atalho
 * Ctrl+K / ⌘K. Acha lead, obra, orçamento, cliente, parceiro, fornecedor ou
 * funcionário pelo código (L00022, S00003, ORC-2026-0014...) ou pelo nome e
 * abre direto. Setas ↑↓ escolhem, Enter abre, Esc fecha. */
export default function BuscaGlobal({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  const fechar = useCallback(() => {
    setAberta(false);
    setQ("");
    setResultados([]);
  }, []);

  // Ctrl+K / ⌘K abre de qualquer tela.
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberta(true);
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);

  useEffect(() => {
    if (!aberta) return;
    setTimeout(() => campo.current?.focus(), 0);
    return empilharModal(fechar);
  }, [aberta, fechar]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(q.trim())}`).then((x) => x.json());
        setResultados(r?.success ? r.data : []);
        setSelecionado(0);
      } finally {
        setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function abrir(r: ResultadoBusca) {
    fechar();
    router.push(r.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className={
          compacto
            ? "rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            : "flex items-center gap-2 rounded-input border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:border-white/40 hover:text-white"
        }
        aria-label="Buscar"
        title="Buscar (Ctrl+K)"
      >
        <Search className="h-4 w-4" aria-hidden />
        {!compacto && (
          <>
            <span>Buscar</span>
            <kbd className="rounded border border-white/20 px-1 text-[11px] text-white/50">Ctrl K</kbd>
          </>
        )}
      </button>

      {aberta && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-brand/60 sm:p-4 sm:pt-[12vh]" onMouseDown={fechar}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar"
            className="flex h-full w-full flex-col bg-white shadow-card-hover sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
              <input
                ref={campo}
                className="min-w-0 flex-1 bg-transparent text-base outline-none"
                placeholder="Código (L00022, S00003, ORC-2026-0014) ou nome..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelecionado((s) => Math.min(s + 1, resultados.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelecionado((s) => Math.max(s - 1, 0));
                  } else if (e.key === "Enter" && resultados[selecionado]) {
                    abrir(resultados[selecionado]);
                  }
                }}
              />
              <button type="button" className="text-sm text-gray-500 hover:text-brand sm:hidden" onClick={fechar}>
                Fechar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {q.trim().length < 2 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Digite pelo menos 2 letras.</p>
              ) : buscando && resultados.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Buscando...</p>
              ) : resultados.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">Nada encontrado.</p>
              ) : (
                <ul role="listbox">
                  {resultados.map((r, i) => (
                    <li key={`${r.tipo}-${r.id}`} role="option" aria-selected={i === selecionado}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === selecionado ? "bg-brand-light" : "hover:bg-gray-50"}`}
                        onMouseEnter={() => setSelecionado(i)}
                        onClick={() => abrir(r)}
                      >
                        <span className="shrink-0 text-brand">{ICONE[r.tipo] ?? <ClipboardList className="h-4 w-4" aria-hidden />}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-800">{r.titulo}</span>
                          {r.detalhe && <span className="block truncate text-xs text-gray-500">{r.detalhe}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
