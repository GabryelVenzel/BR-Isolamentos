"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarMoeda } from "@/lib/format";
import type { FunilResultado } from "@/lib/usecases/resumo";

interface Props {
  funil: FunilResultado;
}

/** Funil de conversão do pipeline comercial — barras decrescentes (não um
 * FunnelChart de verdade: um BarChart horizontal é mais previsível entre
 * versões do Recharts e o pedido original já oferecia essa alternativa). */
export default function LeadsFunnelChart({ funil }: Props) {
  const dados = funil.etapas.map((e) => ({ ...e, cor: e.quantidade === 0 ? "#CCCCCC" : "#060035" }));

  return (
    <div className="card">
      <h3 className="mb-1 font-montserrat text-sm font-bold uppercase text-brand">Funil de Leads</h3>
      {funil.gargalo && (
        <p className="mb-3 text-xs text-status-error">
          Maior queda: {funil.gargalo.deEtapa} → {funil.gargalo.paraEtapa} (−{funil.gargalo.quedaPercentual.toFixed(0)}%)
        </p>
      )}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#333333" }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#333333" }} width={90} />
            <Tooltip
              formatter={(value: number) => [`${value} lead${value === 1 ? "" : "s"}`, "Quantidade"]}
              labelFormatter={(label: string) => {
                const linha = dados.find((d) => d.label === label);
                return linha ? `${label} — ${formatarMoeda(linha.valorTotal)}` : label;
              }}
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
