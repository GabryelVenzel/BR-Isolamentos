"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { corDaObra } from "@/components/operacional/CalendarioCapacidade";
import type { CapacidadeResumoDia, NivelOcupacao } from "@/lib/usecases/operacional";

interface Props {
  dias: CapacidadeResumoDia[];
  hoje: string;
  onEquipeDoDia: (data: string) => void;
}

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const COR_BARRA: Record<NivelOcupacao, string> = {
  livre: "bg-accent",
  atencao: "bg-secondary",
  critico: "bg-status-error",
};

/** Visão SEMANA da Agenda (curto prazo): um bloco por dia com a ocupação da
 * equipe (barra de mobilizados / disponíveis) e TODAS as obras do dia por
 * extenso. No computador, 7 colunas; no celular, um dia embaixo do outro. */
export default function SemanaCapacidade({ dias, hoje, onEquipeDoDia }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {dias.map((dia, i) => {
        const ocupacao = dia.totalDisponivel > 0 ? Math.min(100, (dia.totalMobilizado / dia.totalDisponivel) * 100) : 0;
        const ehHoje = dia.data === hoje;
        return (
          <section key={dia.data} className={`card flex flex-col gap-2 p-3 ${ehHoje ? "ring-2 ring-brand" : ""}`} aria-label={`${DIAS_SEMANA[i]} ${dia.data}`}>
            <header className="flex items-baseline justify-between gap-2 md:block">
              <p className="font-montserrat text-sm font-bold text-gray-700">
                {DIAS_SEMANA[i]} <span className="font-normal text-gray-500">{dia.data.slice(8)}/{dia.data.slice(5, 7)}</span>
                {ehHoje && <span className="ml-1 text-xs font-semibold text-brand">· hoje</span>}
              </p>
            </header>

            <button type="button" className="w-full rounded-input text-left hover:bg-gray-50" onClick={() => onEquipeDoDia(dia.data)} title="Ver a equipe do dia">
              {dia.totalDisponivel > 0 ? (
                <>
                  <span className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      <Users className="icone" aria-hidden /> {dia.totalLivre} livre{dia.totalLivre === 1 ? "" : "s"}
                    </span>
                    <span>
                      {dia.totalMobilizado}/{dia.totalDisponivel}
                    </span>
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gray-100">
                    <span className={`block h-full ${COR_BARRA[dia.nivel]}`} style={{ width: `${ocupacao}%` }} />
                  </span>
                </>
              ) : (
                <span className="text-xs text-gray-400">Sem equipe cadastrada</span>
              )}
            </button>

            {dia.servicos.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhuma obra</p>
            ) : (
              <ul className="space-y-1">
                {dia.servicos.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/operacional/servicos/${s.id}`}
                      className={`block rounded px-2 py-1 text-xs font-semibold text-white hover:opacity-80 ${corDaObra(s.id)}`}
                      title={`${s.numero}${s.cliente ? ` — ${s.cliente}` : ""}`}
                    >
                      {s.numero}
                      {s.cliente && <span className="block truncate font-normal opacity-90">{s.cliente}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
