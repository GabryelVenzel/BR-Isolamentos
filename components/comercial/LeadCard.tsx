"use client";

import Link from "next/link";
import { classesTemperatura, formatarData, formatarMoeda, formatarTemperatura } from "@/lib/format";
import type { Lead } from "@/lib/types/domain";

interface Props {
  lead: Lead;
}

/** Card de um lead dentro de uma coluna do Kanban (ver app/comercial/page.tsx). */
export default function LeadCard({ lead }: Props) {
  return (
    <Link
      href={`/comercial/${lead.id}`}
      className="block rounded-card border border-gray-200 bg-white p-3 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="font-montserrat text-sm font-semibold text-brand">{lead.cliente?.nome ?? "—"}</p>
        <span className={`badge shrink-0 ${classesTemperatura(lead.temperatura)}`}>
          {formatarTemperatura(lead.temperatura)}
        </span>
      </div>
      {lead.valor_estimado > 0 && (
        <p className="font-montserrat text-sm font-bold text-accent">{formatarMoeda(lead.valor_estimado)}</p>
      )}
      {lead.proxima_acao && (
        <p className="mt-1 truncate text-xs text-gray-500">
          {lead.proxima_acao}
          {lead.data_proxima_acao && ` · ${formatarData(lead.data_proxima_acao)}`}
        </p>
      )}
    </Link>
  );
}
