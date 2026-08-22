"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { ProjecaoCaixaResumo } from "@/lib/types/resumo";

interface Props {
  projecao: ProjecaoCaixaResumo;
}

/** Projeção de saldo em caixa pros próximos 30 dias — ver metodologia
 * comentada em lib/usecases/resumo/projecaoCaixa.ts (é uma estimativa, não
 * um saldo bancário real; documentado ali e reforçado na legenda abaixo). */
export default function CashFlowChart({ projecao }: Props) {
  const corLinha = projecao.saldoFinalPeriodo < 0 || projecao.diasNegativos > 0 ? "#DC3545" : "#078B41";
  // Id do gradiente único por instância (via useId) — não custa nada e evita
  // que duas CashFlowChart na mesma página colidam de id de <linearGradient>,
  // mesma classe de bug do isAnimationActive documentada acima.
  // useId() devolve algo como ":r0:" — troca os ":" por "-" só por
  // segurança (evitar qualquer ambiguidade de parsing num seletor url(#...)).
  const idGradiente = `cashflow-gradiente-${useId().replace(/:/g, "-")}`;

  return (
    <div className="card">
      <h3 className="mb-1 font-montserrat text-sm font-bold uppercase text-brand">Projeção de Caixa (30 dias)</h3>
      <p className="mb-3 text-xs text-gray-400">
        Estimativa a partir dos lançamentos já registrados + custos fixos configurados — não é um saldo bancário real.
      </p>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={projecao.dias}>
            <defs>
              <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={corLinha} stopOpacity={0.35} />
                <stop offset="95%" stopColor={corLinha} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#333333" }} tickFormatter={(d) => `D+${d}`} />
            <YAxis tick={{ fontSize: 11, fill: "#333333" }} width={80} tickFormatter={(v) => formatarMoeda(v)} />
            <Tooltip
              formatter={(value: number) => [formatarMoeda(value), "Saldo projetado"]}
              labelFormatter={(dia: number) => {
                const ponto = projecao.dias.find((d) => d.dia === dia);
                return ponto ? formatarData(ponto.data) : `D+${dia}`;
              }}
            />
            <ReferenceLine y={0} stroke="#DC3545" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="saldoProjetado"
              stroke={corLinha}
              fill={`url(#${idGradiente})`}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-gray-400">Saldo hoje</dt>
          <dd className="font-semibold text-gray-800">{formatarMoeda(projecao.saldoHoje)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Final do período</dt>
          <dd className={`font-semibold ${projecao.saldoFinalPeriodo < 0 ? "text-status-error" : "text-gray-800"}`}>
            {formatarMoeda(projecao.saldoFinalPeriodo)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-400">Dias negativos</dt>
          <dd className="font-semibold text-gray-800">{projecao.diasNegativos}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Primeiro dia crítico</dt>
          <dd className="font-semibold text-gray-800">
            {projecao.primeiroDiaNegativo ? formatarData(projecao.primeiroDiaNegativo) : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
