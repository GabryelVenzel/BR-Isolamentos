"use client";

import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { LeadsPorOrigem, PipelineEtapa, VendaMes } from "@/lib/usecases/comercial";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const moedaCurta = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatarMoeda(v));

/** Vendas fechadas por mês do fechamento (valor em barras, quantidade em linha). */
export function VendasPorMesChart({ dados }: { dados: VendaMes[] }) {
  const pontos = dados.map((d) => ({ mes: `${MESES[Number(d.mes.slice(5, 7)) - 1]}/${d.mes.slice(2, 4)}`, Valor: d.valor, Vendas: d.quantidade }));
  return (
    <div className="card">
      <h3 className="font-montserrat text-sm font-bold uppercase text-brand">Vendas fechadas por mês</h3>
      <p className="mb-3 text-xs text-gray-500">Valor fechado (barras) e número de vendas (linha) — últimos 6 meses.</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pontos}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#333333" }} />
            <YAxis yAxisId="v" tick={{ fontSize: 12, fill: "#333333" }} width={84} tickFormatter={moedaCurta} />
            <YAxis yAxisId="q" orientation="right" allowDecimals={false} tick={{ fontSize: 12, fill: "#333333" }} width={32} />
            <Tooltip formatter={(v: number, nome: string) => (nome === "Valor" ? formatarMoeda(v) : v)} />
            <Bar yAxisId="v" dataKey="Valor" fill="#078B41" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="q" dataKey="Vendas" stroke="#060035" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Quanto está em jogo em cada etapa do funil (leads em aberto). */
export function PipelineEtapaChart({ dados }: { dados: PipelineEtapa[] }) {
  return (
    <div className="card">
      <h3 className="font-montserrat text-sm font-bold uppercase text-brand">Pipeline por etapa</h3>
      <p className="mb-3 text-xs text-gray-500">Valor dos leads em aberto em cada etapa.</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#333333" }} tickFormatter={moedaCurta} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#333333" }} width={84} />
            <Tooltip formatter={(v: number, _n: string, item: { payload?: PipelineEtapa }) => [`${formatarMoeda(v)} · ${item.payload?.quantidade ?? 0} lead(s)`, "Em aberto"]} />
            <Bar dataKey="valor" fill="#060035" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Origem dos leads com a conversão de cada canal — onde vale investir. */
export function OrigemTabela({ dados }: { dados: LeadsPorOrigem[] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <h3 className="px-4 pt-4 font-montserrat text-sm font-bold uppercase text-brand">Origem dos leads</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-2 text-left">Origem</th>
            <th className="px-4 py-2 text-right">Leads</th>
            <th className="px-4 py-2 text-right">Fechados</th>
            <th className="px-4 py-2 text-right">Conversão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {dados.map((o) => (
            <tr key={o.origem}>
              <td className="px-4 py-2">{o.origem}</td>
              <td className="px-4 py-2 text-right">
                {o.quantidade} <span className="text-xs text-gray-400">({formatarNumero(o.percentual, 0)}%)</span>
              </td>
              <td className="px-4 py-2 text-right">{o.fechados}</td>
              <td className="px-4 py-2 text-right font-semibold text-brand">{formatarNumero(o.conversaoPercentual, 1)}%</td>
            </tr>
          ))}
          {dados.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                Sem leads no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
