"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { hojeBrasilia } from "@/lib/financeiro";
import { formatarData, formatarNumero } from "@/lib/format";
import type { CapacidadeResumoDia } from "@/lib/usecases/operacional";

const COR = { livre: "#078B41", atencao: "#FBC819", critico: "#DC3545" } as const;

function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Ocupação da equipe nos próximos 30 dias (revisão do Resumo): % das
 * pessoas disponíveis já mobilizadas em obra, dia a dia — mostra folga para
 * vender e dias de aperto. Mesma base da Agenda (capacidade por dia). */
export default function OcupacaoEquipe() {
  const [dias, setDias] = useState<CapacidadeResumoDia[] | null>(null);

  useEffect(() => {
    const hoje = hojeBrasilia();
    const fim = somarDias(hoje, 29);
    const meses = [...new Set([hoje.slice(0, 7), fim.slice(0, 7)])];
    Promise.all(meses.map((m) => fetch(`/api/operacional/capacidade/mes?ano=${Number(m.slice(0, 4))}&mes=${Number(m.slice(5, 7))}`).then((r) => r.json())))
      .then((ps) => setDias(ps.flatMap((p) => (p.success ? (p.data as CapacidadeResumoDia[]) : [])).filter((d) => d.data >= hoje && d.data <= fim)))
      .catch(() => setDias([]));
  }, []);

  if (!dias) return <div className="card h-40 animate-pulse" />;

  const pontos = dias.map((d) => ({ ...d, ocupacao: d.totalDisponivel > 0 ? Math.round((d.totalMobilizado / d.totalDisponivel) * 100) : 0 }));
  const comEquipe = pontos.filter((p) => p.totalDisponivel > 0);
  const media = comEquipe.length > 0 ? comEquipe.reduce((s, p) => s + p.ocupacao, 0) / comEquipe.length : 0;
  const criticos = pontos.filter((p) => p.nivel === "critico").length;
  const livres = pontos.filter((p) => p.totalDisponivel > 0 && p.totalMobilizado === 0).length;

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-montserrat text-sm font-bold uppercase text-brand">Ocupação da equipe — próximos 30 dias</h3>
          <p className="text-xs text-gray-500">Pessoas mobilizadas em obra ÷ pessoas disponíveis, por dia (mesma base da Agenda).</p>
        </div>
        <dl className="flex gap-4 text-right text-xs">
          <div>
            <dt className="text-gray-500">Média</dt>
            <dd className="font-montserrat text-lg font-bold text-brand">{formatarNumero(media, 0)}%</dd>
          </div>
          <div>
            <dt className="text-gray-500">Dias críticos</dt>
            <dd className={`font-montserrat text-lg font-bold ${criticos > 0 ? "text-status-error" : "text-gray-400"}`}>{criticos}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Dias sem obra</dt>
            <dd className="font-montserrat text-lg font-bold text-accent">{livres}</dd>
          </div>
        </dl>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pontos}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="data" tick={{ fontSize: 12, fill: "#333333" }} tickFormatter={(d: string) => `${d.slice(8)}/${d.slice(5, 7)}`} minTickGap={16} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#333333" }} width={40} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              labelFormatter={(d: string) => formatarData(d)}
              formatter={(v: number, _n: string, item: { payload?: (typeof pontos)[number] }) => [
                `${v}% (${item.payload?.totalMobilizado ?? 0} de ${item.payload?.totalDisponivel ?? 0} pessoas)`,
                "Ocupação",
              ]}
            />
            <ReferenceLine y={90} stroke="#DC3545" strokeDasharray="4 4" />
            <Bar dataKey="ocupacao" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {pontos.map((p) => (
                <Cell key={p.data} fill={COR[p.nivel]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
