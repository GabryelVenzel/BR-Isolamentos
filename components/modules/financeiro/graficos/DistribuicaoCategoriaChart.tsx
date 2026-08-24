"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DistribuicaoCategoria } from "@/lib/usecases/financeiro";

interface Props {
  titulo: string;
  dados: DistribuicaoCategoria[];
}

const CORES = ["#060035", "#078B41", "#FBC819", "#0EA5E9", "#DC3545", "#9CA3AF", "#8B5CF6"];

export default function DistribuicaoCategoriaChart({ titulo, dados }: Props) {
  return (
    <div className="card">
      <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">{titulo}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="valor"
              nameKey="categoria"
              cx="50%"
              cy="50%"
              outerRadius={80}
              isAnimationActive={false}
              label={(entrada) => `${entrada.categoria} (${entrada.percentual.toFixed(0)}%)`}
            >
              {dados.map((linha, index) => (
                <Cell key={linha.categoria} fill={CORES[index % CORES.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {dados.length === 0 && <p className="text-center text-xs text-gray-400">Sem dados no período.</p>}
    </div>
  );
}
