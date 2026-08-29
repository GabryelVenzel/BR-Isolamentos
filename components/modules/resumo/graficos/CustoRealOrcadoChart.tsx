"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarMoeda } from "@/lib/format";
import type { CustoRealVsOrcado } from "@/lib/usecases/operacional";

interface Props {
  dados: CustoRealVsOrcado;
}

// Lista revisada (migração 027) — versão abreviada (espaço curto no eixo do
// gráfico), não a mesma fonte completa de MultiSelectTiposTrabalho.tsx.
const LABEL_TIPO: Record<string, string> = {
  bancada: "Bancada",
  isolador: "Isolador",
  funileiro_tracador: "Funileiro",
  caldeiraria: "Cald. Fabricação",
  caldeiraria_montagem: "Cald. Montagem",
  removivel_montagem: "Remov. Montagem",
  removivel_fabricacao: "Remov. Fabricação",
  "Não informado": "Não informado",
};

export default function CustoRealOrcadoChart({ dados }: Props) {
  const dadosGrafico = dados.porTipo.map((d) => ({ ...d, label: LABEL_TIPO[d.tipoTrabalho] ?? d.tipoTrabalho }));

  return (
    <div className="card">
      <h3 className="mb-1 font-montserrat text-sm font-bold uppercase text-brand">Custo Real vs Orçado</h3>
      <p className="mb-3 text-xs text-gray-500">
        Total: {formatarMoeda(dados.totalOrcado)} orçado vs {formatarMoeda(dados.totalReal)} real
        {dados.variancePercentual !== null && ` (${dados.variancePercentual >= 0 ? "+" : ""}${dados.variancePercentual.toFixed(1)}%)`}
      </p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dadosGrafico} margin={{ left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#333333" }} />
            <YAxis tick={{ fontSize: 12, fill: "#333333" }} />
            <Tooltip formatter={(value: number) => formatarMoeda(value)} />
            <Legend />
            <Bar dataKey="orcado" name="Orçado" fill="#060035" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="real" name="Real" fill="#FBC819" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {dadosGrafico.length === 0 && <p className="text-center text-xs text-gray-400">Sem serviços finalizados com valores no período.</p>}
    </div>
  );
}
