"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarMoeda } from "@/lib/format";
import type { ReceitaDespesaMes } from "@/lib/usecases/financeiro";

interface Props {
  dados: ReceitaDespesaMes[];
}

/** Barras de receita/despesa + linha de lucro líquido — `isAnimationActive={false}`
 * em tudo (bug conhecido de múltiplos gráficos Recharts colidindo clipPath
 * na mesma página, já resolvido em módulos anteriores desta sessão). */
export default function ReceitaDespesaChart({ dados }: Props) {
  return (
    <div className="card">
      <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Receita vs Despesa</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#333333" }} />
            <YAxis tick={{ fontSize: 12, fill: "#333333" }} />
            <Tooltip formatter={(value: number) => formatarMoeda(value)} />
            <Legend />
            <Bar dataKey="receita" name="Receita" fill="#078B41" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="despesa" name="Despesa" fill="#DC3545" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line type="monotone" dataKey="lucro" name="Lucro líquido" stroke="#060035" strokeWidth={2} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {dados.length === 0 && <p className="text-center text-xs text-gray-400">Sem lançamentos no período.</p>}
    </div>
  );
}
