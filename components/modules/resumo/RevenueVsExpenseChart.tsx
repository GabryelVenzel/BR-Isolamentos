"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarMoeda } from "@/lib/format";
import type { PontoReceitaDespesa } from "@/lib/types/resumo";

interface Props {
  dados: PontoReceitaDespesa[];
}

/** Receita x Despesa dos últimos 6 meses (barras) + Lucro (linha).
 * `isAnimationActive={false}` em todo Bar/Line/Area/Pie dos gráficos do
 * Resumo: com a animação de entrada ligada e mais de um gráfico Recharts
 * montado na mesma página, os `clipPath` internos (usados pra animar as
 * barras "crescendo") colidem de id entre instâncias — o efeito visual é
 * barras de um gráfico ficando praticamente invisíveis, mesmo com dado
 * correto. Não afeta a interatividade (tooltip, hover) nem a legibilidade;
 * só remove a animação de entrada, aceitável num dashboard que atualiza a
 * cada mudança de filtro. */
export default function RevenueVsExpenseChart({ dados }: Props) {
  return (
    <div className="card">
      <h3 className="mb-4 font-montserrat text-sm font-bold uppercase text-brand">Receita x Despesa (6 meses)</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#333333" }} />
            <YAxis tick={{ fontSize: 12, fill: "#333333" }} width={80} tickFormatter={(v) => formatarMoeda(v)} />
            <Tooltip formatter={(value: number) => formatarMoeda(value)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="receita" name="Receita" fill="#078B41" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="despesa" name="Despesa" fill="#DC3545" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line dataKey="lucro" name="Lucro" stroke="#060035" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
