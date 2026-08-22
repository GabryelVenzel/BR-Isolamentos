"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarMoeda } from "@/lib/format";

interface Props {
  dados: Array<{ mes: string; total: number }>;
}

export default function DashboardChart({ dados }: Props) {
  return (
    <div className="card">
      <h2 className="mb-4 font-montserrat text-sm font-semibold text-brand">Total de orçamentos por mês</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#333333" }} />
            <YAxis tick={{ fontSize: 12, fill: "#333333" }} width={80} tickFormatter={(v) => formatarMoeda(v)} />
            <Tooltip formatter={(value: number) => formatarMoeda(value)} />
            <Bar dataKey="total" fill="#078B41" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
