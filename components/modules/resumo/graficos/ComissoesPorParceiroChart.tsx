"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarMoeda } from "@/lib/format";
import type { ResumoComissaoPorParceiro } from "@/lib/usecases/comercial";

interface Props {
  dados: ResumoComissaoPorParceiro[];
}

/** Comissões por parceiro (migração 026) — mesmo padrão visual dos outros
 * gráficos do dashboard Comercial (OrigemChart.tsx/ResponsavelChart.tsx),
 * mas em barras horizontais (nomes de parceiro tendem a ser mais longos que
 * "origem"/"responsável", cabem melhor no eixo Y). */
export default function ComissoesPorParceiroChart({ dados }: Props) {
  return (
    <div className="card">
      <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Comissões por Parceiro</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v: number) => formatarMoeda(v)} />
            <YAxis type="category" dataKey="parceiroNome" width={110} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => [formatarMoeda(value), "Comissão"]} />
            <Bar dataKey="valorComissao" fill="#078B41" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {dados.length === 0 && <p className="text-center text-xs text-gray-400">Nenhuma comissão registrada ainda.</p>}
    </div>
  );
}
