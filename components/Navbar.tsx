"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Logo from "./Logo";

// Os 6 módulos do ERP. "Orçamento" reúne 3 rotas de topo históricas (wizard,
// histórico, config. de preços — ver lib/module-nav.ts) que não têm um
// prefixo de URL comum; por isso usa `match` para ficar "ativo" em qualquer
// uma delas, mesmo apontando (`href`) só para o histórico.
const LINKS: Array<{ href: string; label: string; match?: string[] }> = [
  { href: "/resumo", label: "Resumo", match: ["/resumo", "/"] },
  { href: "/engenharia", label: "Engenharia" },
  { href: "/comercial", label: "Comercial" },
  { href: "/operacional", label: "Operacional" },
  { href: "/historico", label: "Orçamento", match: ["/historico", "/novo-orcamento", "/config-precos", "/orcamento"] },
  { href: "/financeiro", label: "Financeiro" },
];

/** Um link fica ativo na rota exata, em sub-rotas (ex.: "/comercial" ativo
 * em "/comercial/abc123") e, quando declarado, em qualquer prefixo de
 * `match` (ver "Resumo" e "Orçamento" acima). */
function ehAtivo(pathname: string, link: (typeof LINKS)[number]): boolean {
  const prefixos = link.match ?? [link.href];
  return prefixos.some((prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`));
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [nomeExibicao, setNomeExibicao] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    // A Navbar fica no layout raiz, ao lado de `{children}` — fora do alcance do
    // Error Boundary de app/error.tsx. Se o Supabase não estiver configurado (env
    // vars ausentes), falha silenciosamente aqui em vez de derrubar a página toda.
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (erro) {
      console.error("[Navbar] Supabase indisponível:", erro);
      return;
    }

    async function carregarUsuario(userEmail: string | null) {
      setEmail(userEmail);
      if (!userEmail) {
        setNomeExibicao(null);
        return;
      }
      const { data } = await supabase.from("usuarios").select("nome").eq("email", userEmail).maybeSingle();
      setNomeExibicao(data?.nome ?? null);
    }

    supabase.auth
      .getUser()
      .then(({ data }) => carregarUsuario(data.user?.email ?? null))
      .catch((erro) => console.error("[Navbar] falha ao obter usuário:", erro));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      carregarUsuario(session?.user?.email ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  if (pathname === "/login") return null;

  async function handleLogout() {
    setSaindo(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSaindo(false);
    }
  }

  return (
    <header className="bg-brand">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-4">
        <Link href="/resumo" className="flex items-center">
          <Logo variant="white" height={34} />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => {
            const ativo = ehAtivo(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`border-b-2 py-1 font-montserrat text-sm font-semibold transition-colors ${
                  ativo
                    ? "border-accent text-secondary"
                    : "border-transparent text-white/80 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden font-alfaim text-sm text-white/70 sm:inline">
              {nomeExibicao ?? email}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={saindo}
            className="font-montserrat text-sm font-medium text-white/70 transition-colors hover:text-red-400 disabled:opacity-50"
          >
            Sair
          </button>
        </div>
      </div>

      <nav className="flex items-center gap-4 overflow-x-auto border-t border-white/10 px-4 py-2 md:hidden">
        {LINKS.map((link) => {
          const ativo = ehAtivo(pathname, link);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap font-montserrat text-sm font-semibold ${
                ativo ? "text-secondary" : "text-white/80"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
