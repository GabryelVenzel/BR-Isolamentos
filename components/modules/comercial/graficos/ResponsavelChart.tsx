"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PerformanceResponsavel } from "@/lib/usecases/comercial";

interface Props {
  dados: PerformanceResponsavel[];
}

export default function ResponsavelChart({ dados }: Props) {
  return (
    <div className="card">
      <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Performance por Responsável</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="atribuidoA" tick={{ fontSize: 11, fill: "#333333" }} />
            <YAxis tick={{ fontSize: 12, fill: "#333333" }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalLeads" name="Leads totais" fill="#060035" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="fechados" name="Fechados" fill="#078B41" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {dados.length === 0 && <p className="text-center text-xs text-gray-400">Sem dados no período/filtro selecionado.</p>}
    </div>
  );
}
