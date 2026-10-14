"use client";

import { useEffect, useState } from "react";
import { formatarData, formatarMoeda } from "@/lib/format";
import { TIPOS_TRABALHO_OPCOES } from "@/components/modules/operacional/MultiSelectTiposTrabalho";

const LABEL_ETAPA: Record<string, string> = { planejamento: "Planejamento", execucao: "Execução", finalizado: "Finalizado" };
const LABEL_FUNCAO: Record<string, string> = Object.fromEntries(TIPOS_TRABALHO_OPCOES.map((o) => [o.valor, o.label]));

interface Historico {
  lancamentos: Array<{ id: string; tipo: string; categoria: string; descricao: string | null; valor: number; data: string; pago: boolean; data_pagamento: string | null }>;
  diarias: Array<{ id: string; data: string; valor: number; pago?: boolean | null; servico: { id: string; numero_servico: string } | null }>;
  obras: Array<{ id: string; numero_servico: string; etapa: string; data_inicio: string | null; data_fim_prevista: string | null; cliente: string | null; funcoes: string[] }>;
}

/** Aba "Pagamentos e obras" da ficha (migração 052): o que o funcionário
 * recebeu — lançamentos do Financeiro ligados a ele (salário, pró-labore,
 * adiantamento) e diárias apontadas nas obras — e em quais obras foi alocado. */
export default function HistoricoFuncionario({ funcionarioId }: { funcionarioId: string }) {
  const [h, setH] = useState<Historico | null>(null);

  useEffect(() => {
    fetch(`/api/rh/funcionarios/${funcionarioId}/historico`)
      .then((x) => x.json())
      .then((r) => setH(r?.success ? r.data : { lancamentos: [], diarias: [], obras: [] }))
      .catch(() => setH({ lancamentos: [], diarias: [], obras: [] }));
  }, [funcionarioId]);

  if (!h) return <p className="text-sm text-gray-500">Carregando...</p>;

  const totalLancamentos = h.lancamentos.filter((l) => l.tipo === "despesa").reduce((acc, l) => acc + Number(l.valor), 0);
  const totalDiarias = h.diarias.reduce((acc, d) => acc + Number(d.valor), 0);

  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Pagamentos (Financeiro)</h2>
          {h.lancamentos.length > 0 && <span className="text-sm text-gray-500">Total: {formatarMoeda(totalLancamentos)}</span>}
        </div>
        <p className="text-xs text-gray-500">
          Lançamentos do Financeiro em que o campo "Funcionário" aponta para esta pessoa (salário, pró-labore, adiantamento...).
        </p>
        {h.lancamentos.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum lançamento ligado a este funcionário.</p>
        ) : (
          <table className="tabela-cartoes w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-2 text-left">Vencimento</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {h.lancamentos.map((l) => (
                <tr key={l.id}>
                  <td data-label="Vencimento" className="px-3 py-2">{formatarData(l.data)}</td>
                  <td data-label="Descrição" className="px-3 py-2">{l.descricao || "—"}</td>
                  <td data-label="Categoria" className="px-3 py-2 text-gray-500">{l.categoria}</td>
                  <td data-label="Valor" className="px-3 py-2 text-right">{formatarMoeda(l.valor)}</td>
                  <td data-label="Situação" className="px-3 py-2 text-gray-500">{l.pago ? `Pago${l.data_pagamento ? ` em ${formatarData(l.data_pagamento)}` : ""}` : "Em aberto"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Diárias de obra</h2>
          {h.diarias.length > 0 && (
            <span className="text-sm text-gray-500">
              {h.diarias.length} {h.diarias.length === 1 ? "diária" : "diárias"} · {formatarMoeda(totalDiarias)}
            </span>
          )}
        </div>
        {h.diarias.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma diária apontada (Operacional → Serviços → Diárias).</p>
        ) : (
          <table className="tabela-cartoes w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Obra</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {h.diarias.map((d) => (
                <tr key={d.id}>
                  <td data-label="Data" className="px-3 py-2">{formatarData(d.data)}</td>
                  <td data-label="Obra" className="px-3 py-2">{d.servico?.numero_servico ?? "—"}</td>
                  <td data-label="Valor" className="px-3 py-2 text-right">{formatarMoeda(d.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">Obras em que foi alocado</h2>
        {h.obras.length === 0 ? (
          <p className="text-sm text-gray-400">Ainda não foi alocado em nenhuma obra.</p>
        ) : (
          <table className="tabela-cartoes w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-2 text-left">Obra</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Período</th>
                <th className="px-3 py-2 text-left">Etapa</th>
                <th className="px-3 py-2 text-left">Funções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {h.obras.map((o) => (
                <tr key={o.id}>
                  <td data-label="Obra" className="px-3 py-2 font-medium text-brand">{o.numero_servico}</td>
                  <td data-label="Cliente" className="px-3 py-2">{o.cliente ?? "—"}</td>
                  <td data-label="Período" className="px-3 py-2 text-gray-500">
                    {o.data_inicio ? formatarData(o.data_inicio) : "—"}
                    {o.data_fim_prevista ? ` a ${formatarData(o.data_fim_prevista)}` : ""}
                  </td>
                  <td data-label="Etapa" className="px-3 py-2 text-gray-500">{LABEL_ETAPA[o.etapa] ?? o.etapa}</td>
                  <td data-label="Funções" className="px-3 py-2 text-gray-500">{o.funcoes.map((f) => LABEL_FUNCAO[f] ?? f).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
