"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { formatarMoeda } from "@/lib/format";
import type { CustosFixosVsVariaveis } from "@/lib/usecases/financeiro";

interface Props {
  dados: CustosFixosVsVariaveis;
}

export default function CustosFixosVariaveisChart({ dados }: Props) {
  const dadosGrafico = [
    { nome: "Custos fixos", valor: dados.fixos, cor: "#060035" },
    { nome: "Custos variáveis", valor: dados.variaveis, cor: "#FBC819" },
  ];

  return (
    <div className="card">
      <h3 className="mb-1 font-montserrat text-sm font-bold uppercase text-brand">Custos Fixos vs Variáveis</h3>
      <p className="mb-3 text-xs text-gray-500">Total de despesas no período: {formatarMoeda(dados.totalDespesa)}</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dadosGrafico} margin={{ left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "#333333" }} />
            <YAxis tick={{ fontSize: 12, fill: "#333333" }} />
            <Tooltip formatter={(value: number) => formatarMoeda(value)} />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {dadosGrafico.map((linha) => (
                <Cell key={linha.nome} fill={linha.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
