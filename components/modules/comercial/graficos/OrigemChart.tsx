"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { LeadsPorOrigem } from "@/lib/usecases/comercial";

interface Props {
  dados: LeadsPorOrigem[];
}

const CORES = ["#060035", "#078B41", "#FBC819", "#0EA5E9", "#DC3545", "#6B7280"];

export default function OrigemChart({ dados }: Props) {
  return (
    <div className="card">
      <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Leads por Origem</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="quantidade"
              nameKey="origem"
              cx="50%"
              cy="50%"
              outerRadius={80}
              isAnimationActive={false}
              label={(entrada) => `${entrada.origem} (${entrada.percentual.toFixed(0)}%)`}
            >
              {dados.map((linha, index) => (
                <Cell key={linha.origem} fill={CORES[index % CORES.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [`${value} lead${value === 1 ? "" : "s"}`, "Quantidade"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {dados.length === 0 && <p className="text-center text-xs text-gray-400">Sem dados no período/filtro selecionado.</p>}
    </div>
  );
}
