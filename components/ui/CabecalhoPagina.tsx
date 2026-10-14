"use client";

import Link from "next/link";
import MenuAcoes, { type AcaoMenu } from "./MenuAcoes";

interface Props {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  /** Link de volta, acima do título (fichas e páginas de detalhe). */
  voltar?: { href: string; label: string };
  /** Ação principal (botão primário) — só uma. */
  acaoPrincipal?: { label: string; href?: string; onClick?: () => void };
  /** Ações secundárias, no menu "⋯" ao lado da principal. */
  acoes?: AcaoMenu[];
  /** Conteúdo livre à direita (ex.: botões que não cabem no padrão). */
  extra?: React.ReactNode;
}

/** Cabeçalho padrão de página (revisão de usabilidade): sempre DEPOIS das
 * abas do módulo — título e descrição à esquerda, ação principal e menu "⋯"
 * à direita. No celular as ações ficam na mesma linha do título, à direita,
 * e a descrição vem embaixo. */
export default function CabecalhoPagina({ titulo, descricao, voltar, acaoPrincipal, acoes = [], extra }: Props) {
  return (
    <div className="mb-6 space-y-1">
      {voltar && (
        <Link href={voltar.href} className="inline-block text-sm text-brand hover:underline">
          ← {voltar.label}
        </Link>
      )}
      {/* Quando título e ações não cabem na mesma linha (celular, nomes
          longos), as ações descem para a linha de baixo. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h1 className="break-words text-xl font-bold sm:text-2xl">{titulo}</h1>
        <div className="flex shrink-0 items-center gap-2">
          {extra}
          {acaoPrincipal &&
            (acaoPrincipal.href ? (
              <Link href={acaoPrincipal.href} className="btn-primary whitespace-nowrap">
                {acaoPrincipal.label}
              </Link>
            ) : (
              <button type="button" className="btn-primary whitespace-nowrap" onClick={acaoPrincipal.onClick}>
                {acaoPrincipal.label}
              </button>
            ))}
          <MenuAcoes acoes={acoes} />
        </div>
      </div>
      {descricao && <div className="text-sm text-gray-500">{descricao}</div>}
    </div>
  );
}
