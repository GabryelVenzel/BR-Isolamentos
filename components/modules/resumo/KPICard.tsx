"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { CorTendencia } from "@/lib/types/resumo";

export type CorCard = "verde" | "amarelo" | "vermelho" | "azul" | "neutro";

const CORES_VALOR: Record<CorCard, string> = {
  verde: "text-accent",
  amarelo: "text-secondary-dark",
  vermelho: "text-status-error",
  azul: "text-brand",
  neutro: "text-gray-900",
};

const CORES_BORDA: Record<CorCard, string> = {
  verde: "border-l-accent",
  amarelo: "border-l-secondary",
  vermelho: "border-l-status-error",
  azul: "border-l-brand",
  neutro: "border-l-gray-200",
};

const CORES_TENDENCIA: Record<CorTendencia, string> = {
  positiva: "text-accent",
  negativa: "text-status-error",
  neutra: "text-gray-400",
};

const SETA_TENDENCIA: Record<CorTendencia, string> = {
  positiva: "↑",
  negativa: "↓",
  neutra: "→",
};

interface Props {
  titulo: string;
  icone: string;
  valor: string;
  cor: CorCard;
  tendencia?: { percentual: number | null; cor: CorTendencia; label?: string };
  href?: string;
  children?: ReactNode;
}

/** Card de KPI do dashboard executivo — valor grande + tendência opcional +
 * conteúdo extra livre (breakdown, alerta, mini-sparkline) via `children`.
 * Clicável quando `href` é passado, navegando pro módulo correspondente. */
export default function KPICard({ titulo, icone, valor, cor, tendencia, href, children }: Props) {
  const router = useRouter();
  const clicavel = Boolean(href);

  return (
    <div
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={clicavel ? () => router.push(href!) : undefined}
      onKeyDown={clicavel ? (e) => e.key === "Enter" && router.push(href!) : undefined}
      className={`card border-l-4 ${CORES_BORDA[cor]} ${clicavel ? "cursor-pointer hover:shadow-card-hover" : ""}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
        <span aria-hidden className="text-lg leading-none">
          {icone}
        </span>
      </div>

      {/* truncate + title: grid de 3 colunas (ver app/resumo/page.tsx) já dá
          espaço de sobra pro valor normalmente, mas garante que um valor
          fora do comum não quebre o layout do card — só teria seu texto
          cortado com reticências, com o valor completo disponível no title. */}
      <p className={`mt-2 truncate font-montserrat text-2xl font-bold ${CORES_VALOR[cor]}`} title={valor}>
        {valor}
      </p>

      {tendencia && (
        <p className={`mt-1 text-xs font-semibold ${CORES_TENDENCIA[tendencia.cor]}`}>
          {SETA_TENDENCIA[tendencia.cor]}{" "}
          {tendencia.percentual === null ? "—" : `${tendencia.percentual > 0 ? "+" : ""}${tendencia.percentual.toFixed(1)}%`}
          {tendencia.label ? ` ${tendencia.label}` : " vs período anterior"}
        </p>
      )}

      {children && <div className="mt-2 space-y-1 text-xs text-gray-500">{children}</div>}
    </div>
  );
}
