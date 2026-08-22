"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatarMoeda } from "@/lib/format";
import type { DistribuicaoTipoResumo } from "@/lib/types/resumo";

interface Props {
  dados: DistribuicaoTipoResumo[];
}

const CORES: Record<string, string> = {
  quente: "#DC3545",
  frio: "#060035",
  misto: "#FBC819",
};

/** Mix de vendas por tipo de trabalho (quente/frio/misto) no período — ver
 * lib/usecases/resumo/distribuicaoPorTipo.ts pra fonte dos dados. */
export default function RevenueDistributionChart({ dados }: Props) {
  const semDados = dados.length === 0 || dados.every((d) => d.valor === 0);

  return (
    <div className="card">
      <h3 className="mb-4 font-montserrat text-sm font-bold uppercase text-brand">Distribuição por Tipo</h3>
      {semDados ? (
        <p className="flex h-56 items-center justify-center text-sm text-gray-400">
          Sem orçamentos aceitos no período.
        </p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dados}
                dataKey="valor"
                nameKey="label"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {dados.map((linha) => (
                  <Cell key={linha.tipo} fill={CORES[linha.tipo] ?? "#CCCCCC"} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, nome: string) => [formatarMoeda(value), nome]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
