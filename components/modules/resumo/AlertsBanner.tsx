"use client";

import Link from "next/link";
import type { AlertaResumo } from "@/lib/types/resumo";

interface Props {
  alertas: AlertaResumo[];
}

/** Faixa de alertas críticos no topo do dashboard — vermelho quando há
 * alerta "critico", amarelo quando só há "atencao", verde quando não há
 * nenhum. Ver lib/usecases/resumo/listarAlertas.ts pras 4 verificações. */
export default function AlertsBanner({ alertas }: Props) {
  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-card border-l-4 border-l-accent bg-accent-light/60 p-4 text-sm text-accent-dark">
        <span aria-hidden>✅</span>
        <span className="font-montserrat font-semibold">Tudo funcionando normalmente — nenhum alerta no momento.</span>
      </div>
    );
  }

  const temCritico = alertas.some((a) => a.severidade === "critico");

  return (
    <div
      className={`rounded-card border-l-4 p-4 ${
        temCritico ? "border-l-status-error bg-red-50" : "border-l-secondary bg-secondary-light/60"
      }`}
    >
      <p className={`mb-2 font-montserrat text-sm font-bold ${temCritico ? "text-status-error" : "text-brand"}`}>
        {temCritico ? "🔴 ALERTAS CRÍTICOS" : "🟡 ATENÇÃO"}
      </p>
      <ul className="space-y-1.5">
        {alertas.map((alerta) => (
          <li key={alerta.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
            <span>
              {alerta.severidade === "critico" ? "•" : "◦"} {alerta.mensagem}
            </span>
            <Link href={alerta.href} className="whitespace-nowrap font-semibold text-brand hover:underline">
              {alerta.acaoLabel} →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
