"use client";

import { useId, useState } from "react";
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { FluxoCaixa } from "@/lib/usecases/resumo";

const VERDE = "#078B41";
const VERDE_CLARO = "#9fd8b5";
const VERMELHO = "#DC3545";
const VERMELHO_CLARO = "#f2a9b0";
const AZUL = "#060035";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const moedaCurta = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatarMoeda(v));

/** Indicadores do caixa: hoje, menor saldo previsto, saldo em 30/60/90 dias
 * e o que está vencido (a receber = risco; a pagar = já descontado). */
export function IndicadoresCaixa({ fluxo, compacto = false }: { fluxo: FluxoCaixa; compacto?: boolean }) {
  const itens = [
    { titulo: "Caixa hoje", valor: fluxo.saldoHoje, detalhe: `Desde ${formatarData(fluxo.dataInicial)} (início do caixa)` },
    {
      titulo: "Menor saldo previsto",
      valor: fluxo.menorSaldo.valor,
      detalhe: fluxo.primeiroDiaNegativo ? `Fica negativo em ${formatarData(fluxo.primeiroDiaNegativo)}` : `Em ${formatarData(fluxo.menorSaldo.data)} — 90 dias`,
    },
    { titulo: "Saldo em 30 dias", valor: fluxo.saldoEm.d30, detalhe: `60 dias: ${formatarMoeda(fluxo.saldoEm.d60)} · 90 dias: ${formatarMoeda(fluxo.saldoEm.d90)}` },
    {
      titulo: "A receber vencido",
      valor: fluxo.aReceberVencido.valor,
      detalhe: fluxo.aReceberVencido.quantidade > 0 ? `${fluxo.aReceberVencido.quantidade} conta(s) — fora da projeção (risco)` : "Nada vencido",
      risco: fluxo.aReceberVencido.valor > 0,
    },
  ];
  const lista = compacto ? itens.slice(0, 2) : itens;
  return (
    <div className={`grid grid-cols-2 gap-3 ${compacto ? "" : "lg:grid-cols-4"}`}>
      {lista.map((i) => (
        <div key={i.titulo} className={`card border-l-4 p-4 ${i.valor < 0 || i.risco ? "border-l-status-error" : "border-l-accent"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{i.titulo}</p>
          <p className={`mt-1 truncate font-montserrat text-lg font-bold sm:text-xl ${i.valor < 0 || i.risco ? "text-status-error" : "text-brand"}`}>{formatarMoeda(i.valor)}</p>
          <p className="text-xs text-gray-500">{i.detalhe}</p>
        </div>
      ))}
    </div>
  );
}

/** Gráfico do fluxo de caixa: POR MÊS (entradas e saídas realizadas em cor
 * cheia, previstas em cor clara, e a linha do saldo no fim de cada mês) ou
 * DIÁRIO (saldo previsto dia a dia nos próximos 90 dias, verde acima de
 * zero e vermelho abaixo). */
export function GraficoFluxoCaixa({ fluxo, titulo = "Fluxo de caixa" }: { fluxo: FluxoCaixa; titulo?: string }) {
  const [modo, setModo] = useState<"mensal" | "diario">("mensal");
  const id = `fc-${useId().replace(/:/g, "-")}`;

  const dadosMes = fluxo.meses.map((m) => ({
    mes: rotuloMes(m.mes) + (m.situacao === "atual" ? " (atual)" : ""),
    "Entradas realizadas": m.entradasRealizadas,
    "Entradas previstas": m.entradasPrevistas,
    "Saídas realizadas": -m.saidasRealizadas,
    "Saídas previstas": -m.saidasPrevistas,
    "Saldo no fim do mês": m.saldoFinal,
  }));

  const valores = fluxo.diario.map((d) => d.saldo);
  const maximo = Math.max(...valores, 0);
  const minimo = Math.min(...valores, 0);
  const corte = maximo === minimo ? 0.5 : maximo / (maximo - minimo);

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-montserrat text-sm font-bold uppercase text-brand">{titulo}</h3>
          <p className="text-xs text-gray-500">
            Regime de caixa (quando o dinheiro entra e sai), com as projeções do Financeiro. Contas a pagar vencidas saem hoje; a receber vencidas
            não entram.
          </p>
        </div>
        <div className="inline-flex rounded-input border border-gray-200 bg-white p-0.5" role="group" aria-label="Visão do fluxo de caixa">
          {(
            [
              ["mensal", "Por mês"],
              ["diario", "Próximos 90 dias"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={modo === v}
              className={`rounded-input px-3 py-1 text-xs font-semibold ${modo === v ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setModo(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {modo === "mensal" ? (
            <ComposedChart data={dadosMes} stackOffset="sign">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#333333" }} />
              <YAxis tick={{ fontSize: 12, fill: "#333333" }} width={84} tickFormatter={moedaCurta} />
              <Tooltip formatter={(v: number, nome: string) => [formatarMoeda(Math.abs(v) === 0 ? 0 : nome.startsWith("Saldo") ? v : Math.abs(v)), nome]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Bar dataKey="Entradas realizadas" stackId="e" fill={VERDE} isAnimationActive={false} />
              <Bar dataKey="Entradas previstas" stackId="e" fill={VERDE_CLARO} isAnimationActive={false} />
              <Bar dataKey="Saídas realizadas" stackId="s" fill={VERMELHO} isAnimationActive={false} />
              <Bar dataKey="Saídas previstas" stackId="s" fill={VERMELHO_CLARO} isAnimationActive={false} />
              <Line dataKey="Saldo no fim do mês" stroke={AZUL} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          ) : (
            <AreaChart data={fluxo.diario}>
              <defs>
                <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset={corte} stopColor={VERDE} />
                  <stop offset={corte} stopColor={VERMELHO} />
                </linearGradient>
                <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={VERDE} stopOpacity={0.3} />
                  <stop offset={corte} stopColor={VERDE} stopOpacity={0.04} />
                  <stop offset={corte} stopColor={VERMELHO} stopOpacity={0.04} />
                  <stop offset="100%" stopColor={VERMELHO} stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="data" tick={{ fontSize: 12, fill: "#333333" }} tickFormatter={(d: string) => `${d.slice(8)}/${d.slice(5, 7)}`} minTickGap={24} />
              <YAxis domain={[minimo, maximo]} tick={{ fontSize: 12, fill: "#333333" }} width={84} tickFormatter={moedaCurta} />
              <Tooltip
                labelFormatter={(d: string) => formatarData(d)}
                formatter={(v: number, nome: string) => [formatarMoeda(v), nome === "saldo" ? "Saldo previsto" : nome]}
              />
              <ReferenceLine y={0} stroke={VERMELHO} strokeDasharray="4 4" />
              <Area type="stepAfter" dataKey="saldo" stroke={`url(#${id}-l)`} fill={`url(#${id}-a)`} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Próximas semanas: saldo inicial, entradas, saídas e saldo final. */
export function TabelaSemanasCaixa({ fluxo }: { fluxo: FluxoCaixa }) {
  return (
    <div className="card overflow-x-auto p-0">
      <h3 className="px-4 pt-4 font-montserrat text-sm font-bold uppercase text-brand">Próximas semanas</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-2 text-left">Semana</th>
            <th className="px-4 py-2 text-right">Saldo inicial</th>
            <th className="px-4 py-2 text-right">Entradas</th>
            <th className="px-4 py-2 text-right">Saídas</th>
            <th className="px-4 py-2 text-right">Saldo final</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {fluxo.semanas.map((s) => (
            <tr key={s.inicio}>
              <td className="whitespace-nowrap px-4 py-2">
                {s.inicio.slice(8)}/{s.inicio.slice(5, 7)} a {s.fim.slice(8)}/{s.fim.slice(5, 7)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-gray-500">{formatarMoeda(s.saldoInicial)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-accent">{s.entradas ? formatarMoeda(s.entradas) : "—"}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-status-error">{s.saidas ? formatarMoeda(s.saidas) : "—"}</td>
              <td className={`whitespace-nowrap px-4 py-2 text-right font-semibold ${s.saldoFinal < 0 ? "text-status-error" : "text-brand"}`}>{formatarMoeda(s.saldoFinal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Contas em aberto por prazo (vencidas e a vencer). */
export function TabelaAging({ fluxo }: { fluxo: FluxoCaixa }) {
  const total = fluxo.aging.reduce((t, f) => ({ r: t.r + f.aReceber, p: t.p + f.aPagar }), { r: 0, p: 0 });
  return (
    <div className="card overflow-x-auto p-0">
      <h3 className="px-4 pt-4 font-montserrat text-sm font-bold uppercase text-brand">Contas em aberto por prazo</h3>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="table-header">
            <th className="px-4 py-2 text-left">Prazo</th>
            <th className="px-4 py-2 text-right">A receber</th>
            <th className="px-4 py-2 text-right">A pagar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {fluxo.aging.map((f, i) => (
            <tr key={f.label} className={i < 2 && (f.aReceber || f.aPagar) ? "bg-red-50/60" : ""}>
              <td className="px-4 py-2">{f.label}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-accent">{f.aReceber ? formatarMoeda(f.aReceber) : "—"}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-status-error">{f.aPagar ? formatarMoeda(f.aPagar) : "—"}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="px-4 py-2">Total em aberto</td>
            <td className="whitespace-nowrap px-4 py-2 text-right">{formatarMoeda(total.r)}</td>
            <td className="whitespace-nowrap px-4 py-2 text-right">{formatarMoeda(total.p)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
