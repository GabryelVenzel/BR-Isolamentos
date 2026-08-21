"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/novo-orcamento", label: "Novo Orçamento" },
  { href: "/historico", label: "Histórico" },
  { href: "/config-precos", label: "Configurar Preços" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [nomeExibicao, setNomeExibicao] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function carregarUsuario(userEmail: string | null) {
      setEmail(userEmail);
      if (!userEmail) {
        setNomeExibicao(null);
        return;
      }
      const { data } = await supabase.from("usuarios").select("nome").eq("email", userEmail).maybeSingle();
      setNomeExibicao(data?.nome ?? null);
    }

    supabase.auth.getUser().then(({ data }) => carregarUsuario(data.user?.email ?? null));

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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand">
          <Image src="/logo.png" alt="BR Isolamentos" width={32} height={32} className="rounded" />
          BR Isolamentos
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-accent ${
                pathname === link.href ? "text-accent" : "text-gray-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {email && <span className="hidden text-sm text-gray-500 sm:inline">{nomeExibicao ?? email}</span>}
          <button
            type="button"
            onClick={handleLogout}
            disabled={saindo}
            className="text-sm font-medium text-gray-600 hover:text-red-600 disabled:opacity-50"
          >
            Sair
          </button>
        </div>
      </div>

      <nav className="flex items-center gap-4 overflow-x-auto border-t border-gray-100 px-4 py-2 md:hidden">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap text-sm font-medium ${
              pathname === link.href ? "text-accent" : "text-gray-600"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
