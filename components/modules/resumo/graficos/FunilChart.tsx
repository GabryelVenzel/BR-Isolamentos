"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FunilComercial } from "@/lib/usecases/comercial";

interface Props {
  funil: FunilComercial;
}

/** Funil de conversão cumulativo (ver lib/usecases/comercial/relatorio.ts) —
 * mesma técnica de "BarChart horizontal" de components/modules/resumo/LeadsFunnelChart.tsx
 * (mais previsível entre versões do Recharts que um FunnelChart de verdade).
 * `isAnimationActive={false}`: bug conhecido de múltiplos gráficos Recharts
 * na mesma página colidindo clipPath — ver histórico do módulo Resumo. */
export default function FunilChart({ funil }: Props) {
  const dados = funil.etapas.map((e) => ({ ...e, cor: e.quantidade === 0 ? "#CCCCCC" : "#060035" }));

  return (
    <div className="card">
      <h3 className="mb-1 font-montserrat text-sm font-bold uppercase text-brand">Funil de Conversão</h3>
      <p className="mb-1 text-xs text-gray-500">Leads do período que chegaram até cada etapa (ou passaram dela).</p>
      {funil.gargalo && funil.gargalo.quedaPercentual > 0 ? (
        <p className="mb-3 text-xs text-status-error">
          Maior perda: {funil.gargalo.deEtapa} → {funil.gargalo.paraEtapa} (−{funil.gargalo.quedaPercentual.toFixed(0)}%)
        </p>
      ) : (
        <p className="mb-3 text-xs text-gray-500">Sem perda entre etapas no período.</p>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#333333" }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#333333" }} width={90} />
            <Tooltip
              formatter={(value: number, _n, item) => [
                `${value} lead${value === 1 ? "" : "s"}${
                  item?.payload?.retencaoPercentual !== null ? ` (${item.payload.retencaoPercentual.toFixed(0)}% retenção)` : ""
                }`,
                "Quantidade",
              ]}
            />
            <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {dados.map((linha) => (
                <Cell key={linha.etapa} fill={linha.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
