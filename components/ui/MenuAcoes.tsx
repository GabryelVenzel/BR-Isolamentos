"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

export interface AcaoMenu {
  label: string;
  /** Navega (link) ou executa (botão). */
  href?: string;
  onClick?: () => void;
  icone?: React.ReactNode;
  perigo?: boolean;
  /** Abre em nova aba (links de arquivo/PDF). */
  novaAba?: boolean;
}

interface Props {
  acoes: AcaoMenu[];
  /** Texto do botão; padrão é só o ícone "⋯". */
  rotulo?: string;
  alinhar?: "esquerda" | "direita";
  /** Classe do botão (padrão: botão secundário no tamanho dos demais). */
  classeBotao?: string;
  /** Nas linhas de lista/tabela: só o ícone, sem borda (área de toque de 40px). */
  discreto?: boolean;
}

/** Menu "⋯" com ações secundárias (revisão de usabilidade): a ação principal
 * da tela ou da linha fica em destaque, e o resto (Lixeira, Exportar, PDF,
 * Excluir...) vem aqui. Fecha ao clicar fora, ao escolher uma ação ou com Esc. */
export default function MenuAcoes({ acoes, rotulo, alinhar = "direita", classeBotao, discreto }: Props) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  // Posição fixa na tela, calculada a partir do botão: assim o menu não é
  // cortado por tabelas com rolagem horizontal (overflow) e abre para cima
  // quando o botão está perto do fim da tela.
  const [posicao, setPosicao] = useState<React.CSSProperties>({});

  function abrir() {
    const r = botao.current?.getBoundingClientRect();
    if (r) {
      const alturaEstimada = acoes.length * 44 + 8;
      const paraCima = r.bottom + alturaEstimada > window.innerHeight - 8 && r.top > alturaEstimada;
      setPosicao({
        position: "fixed",
        ...(paraCima ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
        ...(alinhar === "direita" ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, r.left) }),
      });
    }
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    const fechar = () => setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", fechar);
    window.addEventListener("scroll", fechar, true);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", fechar);
      window.removeEventListener("scroll", fechar, true);
    };
  }, [aberto]);

  if (acoes.length === 0) return null;

  return (
    <div ref={raiz} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={botao}
        type="button"
        className={classeBotao ?? (discreto ? "inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-brand" : "btn-secondary px-3")}
        aria-label={rotulo ?? "Mais ações"}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir())}
      >
        {rotulo ?? <MoreHorizontal className="h-5 w-5" aria-hidden />}
      </button>
      {aberto && (
        <div
          role="menu"
          style={posicao}
          className="z-[70] min-w-[12rem] overflow-hidden rounded-card border border-gray-200 bg-white py-1 text-sm shadow-card-hover"
        >
          {acoes.map((acao) => {
            const classe = `flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 ${acao.perigo ? "text-status-error" : "text-gray-700"}`;
            const conteudo = (
              <>
                {acao.icone}
                {acao.label}
              </>
            );
            return acao.href ? (
              <Link
                key={acao.label}
                role="menuitem"
                href={acao.href}
                className={classe}
                target={acao.novaAba ? "_blank" : undefined}
                rel={acao.novaAba ? "noreferrer" : undefined}
                onClick={() => setAberto(false)}
              >
                {conteudo}
              </Link>
            ) : (
              <button
                key={acao.label}
                role="menuitem"
                type="button"
                className={classe}
                onClick={() => {
                  setAberto(false);
                  acao.onClick?.();
                }}
              >
                {conteudo}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
