"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ParceiroTopResumo } from "@/lib/types/resumo";

interface Props {
  parceiros: ParceiroTopResumo[];
}

const LIMITE_ALERTA = 95;

/** Top 5 parceiros por horas alocadas este mês — barra colorida por
 * percentual de utilização (verde normal, vermelho quando ultrapassa 95%,
 * mesmo limite do alerta "parceiro no limite" do AlertsBanner). */
export default function TopPartnersChart({ parceiros }: Props) {
  const dados = parceiros.map((p) => ({
    ...p,
    rotulo: `${p.nome} (${p.percentualUtilizacao.toFixed(0)}%)`,
  }));

  return (
    <div className="card">
      <h3 className="mb-4 font-montserrat text-sm font-bold uppercase text-brand">Top Parceiros (mês)</h3>
      {parceiros.length === 0 ? (
        <p className="flex h-56 items-center justify-center text-sm text-gray-400">
          Nenhum agendamento com parceiro este mês.
        </p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" tick={{ fontSize: 12, fill: "#333333" }} unit="h" />
              <YAxis type="category" dataKey="rotulo" tick={{ fontSize: 12, fill: "#333333" }} width={140} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(1)}h`, "Horas alocadas"]} />
              <Bar dataKey="horasAlocadas" name="Horas alocadas" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {dados.map((p) => (
                  <Cell key={p.id} fill={p.percentualUtilizacao >= LIMITE_ALERTA ? "#DC3545" : "#078B41"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
