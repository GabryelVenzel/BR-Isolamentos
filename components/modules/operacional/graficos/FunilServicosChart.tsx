"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EtapaFunilServico } from "@/lib/usecases/operacional";

interface Props {
  funil: EtapaFunilServico[];
}

const CORES: Record<string, string> = { planejamento: "#060035", execucao: "#078B41", finalizado: "#9CA3AF" };

export default function FunilServicosChart({ funil }: Props) {
  const dados = funil.map((e) => ({ ...e, cor: CORES[e.etapa] ?? "#060035" }));

  return (
    <div className="card">
      <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Funil de Serviços</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#333333" }} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#333333" }} width={90} />
            <Tooltip
              formatter={(value: number, _n, item) => [
                `${value} serviço${value === 1 ? "" : "s"}${
                  item?.payload?.retencaoPercentual !== null ? ` (${item.payload.retencaoPercentual.toFixed(0)}%)` : ""
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
