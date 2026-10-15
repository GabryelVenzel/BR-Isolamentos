"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, KeyRound, LogOut, Menu, Plus, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Logo from "./Logo";
import SinoAlertas from "./SinoAlertas";
import BuscaGlobal from "./BuscaGlobal";
import MenuAcoes, { type AcaoMenu } from "./ui/MenuAcoes";
import { podeAcessarModulo, type Acesso, type Modulo } from "@/lib/acesso";
import { useAcesso } from "@/lib/hooks/useAcesso";
import { classeLargura } from "@/lib/largura";
import { COMERCIAL_SUBNAV, ENGENHARIA_SUBNAV, FINANCEIRO_SUBNAV, OPERACIONAL_SUBNAV, ORCAMENTO_SUBNAV, RESUMO_SUBNAV, RH_SUBNAV } from "@/lib/module-nav";
import type { ModuleSubNavItem } from "./ModuleSubNav";

const LINKS: Array<{ href: string; label: string; modulo: Modulo; match?: string[]; sub?: ModuleSubNavItem[] }> = [
  { href: "/resumo", label: "Resumo", modulo: "resumo", match: ["/resumo", "/"], sub: RESUMO_SUBNAV },
  { href: "/engenharia/quente", label: "Engenharia", modulo: "engenharia", match: ["/engenharia"], sub: ENGENHARIA_SUBNAV },
  { href: "/comercial", label: "Comercial", modulo: "comercial", sub: COMERCIAL_SUBNAV },
  { href: "/operacional", label: "Operacional", modulo: "operacional", sub: OPERACIONAL_SUBNAV },
  { href: "/historico", label: "Orçamento", modulo: "orcamento", match: ["/historico", "/novo-orcamento", "/config-precos", "/orcamento"], sub: ORCAMENTO_SUBNAV },
  { href: "/financeiro", label: "Financeiro", modulo: "financeiro", sub: FINANCEIRO_SUBNAV },
  { href: "/rh", label: "RH", modulo: "rh", sub: RH_SUBNAV },
];

/** Atalhos do "+ Criar" (revisão de usabilidade) — abrem a tela já com o
 * formulário de criação aberto, sem precisar navegar até o módulo. */
const CRIAR: Array<{ label: string; href: string; modulo: Modulo }> = [
  { label: "Novo lead", href: "/comercial?novo=lead", modulo: "comercial" },
  { label: "Novo orçamento", href: "/novo-orcamento", modulo: "orcamento" },
  { label: "Novo serviço", href: "/operacional/servicos?novo=1", modulo: "operacional" },
  { label: "Novo lançamento", href: "/financeiro/lancamentos?novo=1", modulo: "financeiro" },
];

function linksVisiveis(acesso: Acesso | null) {
  return acesso ? LINKS.filter((link) => podeAcessarModulo(acesso, link.modulo)) : [];
}

function ehAtivo(pathname: string, link: (typeof LINKS)[number]): boolean {
  const prefixos = link.match ?? [link.href];
  return prefixos.some((prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`));
}

/** Cabeçalho do app (revisão de usabilidade):
 *
 *   - fica FIXO no topo ao rolar — trocar de módulo não exige voltar ao topo
 *     de telas longas;
 *   - computador: módulos, busca geral (Ctrl+K), "+ Criar", alertas e menu do
 *     usuário (Senha/Sair);
 *   - celular: logo, busca, alertas e ☰, que abre uma gaveta com todos os
 *     módulos e as abas de cada um — antes era uma faixa que rolava para o
 *     lado e escondia metade dos módulos;
 *   - enquanto os acessos carregam, um esqueleto ocupa o lugar dos módulos
 *     (antes o menu aparecia vazio por um instante). */
export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [nomeExibicao, setNomeExibicao] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const { acesso } = useAcesso();
  const links = linksVisiveis(acesso);
  const criar = acesso ? CRIAR.filter((c) => podeAcessarModulo(acesso, c.modulo)) : [];

  useEffect(() => {
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

  // Trocou de tela: fecha a gaveta.
  useEffect(() => {
    setGavetaAberta(false);
  }, [pathname]);

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

  const acoesUsuario: AcaoMenu[] = [
    { label: "Trocar senha", href: "/conta/senha", icone: <KeyRound className="h-4 w-4" aria-hidden /> },
    { label: saindo ? "Saindo..." : "Sair", onClick: handleLogout, icone: <LogOut className="h-4 w-4" aria-hidden />, perigo: true },
  ];

  return (
    <header className="sticky top-0 z-40 bg-brand shadow-sm">
      <div className={`mx-auto flex h-14 items-center justify-between gap-3 px-4 ${classeLargura(pathname)}`}>
        <Link href="/" className="flex shrink-0 items-center" aria-label="Início">
          <Logo variant="white" height={30} />
        </Link>

        <nav className="hidden min-w-0 items-center gap-5 lg:flex" aria-label="Módulos">
          {acesso
            ? links.map((link) => {
                const ativo = ehAtivo(pathname, link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`whitespace-nowrap border-b-2 py-1 font-montserrat text-sm font-semibold transition-colors ${
                      ativo ? "border-accent text-secondary" : "border-transparent text-white/80 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })
            : Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-3 w-16 animate-pulse rounded bg-white/15" aria-hidden />)}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <span className="hidden sm:inline-flex">
            <BuscaGlobal />
          </span>
          <span className="sm:hidden">
            <BuscaGlobal compacto />
          </span>
          {criar.length > 0 && (
            <span className="hidden lg:inline-flex">
              <MenuAcoes
                rotulo="Criar"
                classeBotao="flex items-center gap-1 rounded-input bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark"
                acoes={criar.map((c) => ({ label: c.label, href: c.href, icone: <Plus className="h-4 w-4" aria-hidden /> }))}
              />
            </span>
          )}
          {acesso?.ativo && !acesso.trocarSenha && <SinoAlertas admin={acesso.admin} />}
          <span className="hidden lg:inline-flex">
            <MenuAcoes
              rotulo={nomeExibicao ?? email ?? "Conta"}
              classeBotao="flex max-w-[12rem] items-center gap-1 truncate rounded-input px-2 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              acoes={acoesUsuario}
            />
          </span>
          <button
            type="button"
            className="rounded-full p-2 text-white hover:bg-white/10 lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={gavetaAberta}
            onClick={() => setGavetaAberta(true)}
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </div>

      {gavetaAberta && (
        <GavetaMenu
          links={links}
          criar={criar}
          pathname={pathname}
          nome={nomeExibicao ?? email}
          admin={!!acesso?.admin}
          saindo={saindo}
          onSair={handleLogout}
          onFechar={() => setGavetaAberta(false)}
        />
      )}
    </header>
  );
}

/** Gaveta do celular (☰): todos os módulos, cada um com as suas abas, os
 * atalhos de criação e Senha/Sair. O módulo atual já vem aberto. */
function GavetaMenu({
  links,
  criar,
  pathname,
  nome,
  admin,
  saindo,
  onSair,
  onFechar,
}: {
  links: typeof LINKS;
  criar: typeof CRIAR;
  pathname: string;
  nome: string | null;
  admin: boolean;
  saindo: boolean;
  onSair: () => void;
  onFechar: () => void;
}) {
  const [abertos, setAbertos] = useState<string[]>(() => links.filter((l) => ehAtivo(pathname, l)).map((l) => l.href));

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-brand/60" onClick={onFechar} />
      <div className="absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col bg-white shadow-card-hover">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="truncate text-sm text-gray-600">{nome ?? "Menu"}</span>
          <button type="button" className="rounded-full p-2 text-gray-500 hover:bg-gray-100" aria-label="Fechar menu" onClick={onFechar}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Módulos">
          {links.map((link) => {
            const ativo = ehAtivo(pathname, link);
            const sub = (link.sub ?? []).filter((s) => !s.apenasAdmin || admin);
            const aberto = abertos.includes(link.href);
            return (
              <div key={link.href} className="border-b border-gray-50">
                <div className="flex items-center">
                  <Link href={link.href} className={`flex-1 px-4 py-3 font-montserrat text-base font-semibold ${ativo ? "text-brand" : "text-gray-700"}`}>
                    {link.label}
                  </Link>
                  {sub.length > 0 && (
                    <button
                      type="button"
                      className="p-3 text-gray-400"
                      aria-label={aberto ? `Recolher ${link.label}` : `Mostrar abas de ${link.label}`}
                      aria-expanded={aberto}
                      onClick={() => setAbertos((a) => (aberto ? a.filter((h) => h !== link.href) : [...a, link.href]))}
                    >
                      <ChevronDown className={`h-5 w-5 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                  )}
                </div>
                {aberto && sub.length > 0 && (
                  <div className="pb-2">
                    {sub.map((s) => (
                      <Link key={s.href} href={s.href} className="block py-2 pl-8 pr-4 text-sm text-gray-600 hover:bg-gray-50">
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {criar.length > 0 && (
            <div className="px-4 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Criar</p>
              <div className="grid grid-cols-2 gap-2">
                {criar.map((c) => (
                  <Link key={c.href} href={c.href} className="rounded-input border border-gray-200 px-3 py-2 text-sm text-brand hover:bg-gray-50">
                    + {c.label.replace(/^Novo /, "").replace(/^./, (l) => l.toUpperCase())}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>
        <div className="flex border-t border-gray-100">
          <Link href="/conta/senha" className="flex flex-1 items-center justify-center gap-2 py-3 text-sm text-gray-600 hover:bg-gray-50">
            <KeyRound className="h-4 w-4" aria-hidden /> Senha
          </Link>
          <button type="button" className="flex flex-1 items-center justify-center gap-2 py-3 text-sm text-status-error hover:bg-gray-50" onClick={onSair} disabled={saindo}>
            <LogOut className="h-4 w-4" aria-hidden /> {saindo ? "Saindo..." : "Sair"}
          </button>
        </div>
      </div>
    </div>
  );
}
