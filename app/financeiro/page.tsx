"use client";

import { useCallback, useEffect, useState } from "react";
import NovoLancamentoModal from "@/components/financeiro/NovoLancamentoModal";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { LancamentoFinanceiro } from "@/lib/types/domain";
import type { ResumoMesAtual } from "@/lib/repositories";

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [resumo, setResumo] = useState<(ResumoMesAtual & { custosFixosMensal: number }) | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [respLancamentos, respResumo] = await Promise.all([
        fetch("/api/financeiro/lancamentos"),
        fetch("/api/financeiro/resumo"),
      ]);
      const [payloadLancamentos, payloadResumo] = await Promise.all([respLancamentos.json(), respResumo.json()]);

      if (!payloadLancamentos.success) {
        setErro(payloadLancamentos.error ?? "Erro ao carregar lançamentos.");
        return;
      }
      setLancamentos(payloadLancamentos.data);
      if (payloadResumo.success) setResumo(payloadResumo.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function marcarPago(id: string) {
    const response = await fetch(`/api/financeiro/lancamentos/${id}/pagar`, { method: "POST" });
    const payload = await response.json();
    if (payload.success) {
      setLancamentos((prev) => prev.map((l) => (l.id === id ? payload.data : l)));
    }
  }

  const lucroLiquidoEstimado = resumo ? resumo.lucro_bruto - resumo.custosFixosMensal : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-gray-500">Fluxo de caixa — receitas, despesas e custos fixos.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setMostrarNovo(true)}>
          + Novo Lançamento
        </button>
      </div>

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      {resumo && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-xs font-medium uppercase text-gray-500">Receita do mês</p>
            <p className="mt-2 font-montserrat text-2xl font-bold text-accent">{formatarMoeda(resumo.receita_total)}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase text-gray-500">Despesa do mês</p>
            <p className="mt-2 font-montserrat text-2xl font-bold text-status-error">{formatarMoeda(resumo.despesa_total)}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase text-gray-500">Custos fixos (mensal)</p>
            <p className="mt-2 font-montserrat text-2xl font-bold text-brand">{formatarMoeda(resumo.custosFixosMensal)}</p>
          </div>
          <div className="card">
            <p className="text-xs font-medium uppercase text-gray-500">Lucro líquido estimado</p>
            <p className={`mt-2 font-montserrat text-2xl font-bold ${lucroLiquidoEstimado >= 0 ? "text-accent" : "text-status-error"}`}>
              {formatarMoeda(lucroLiquidoEstimado)}
            </p>
          </div>
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lancamentos.map((lancamento) => (
                <tr key={lancamento.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{formatarData(lancamento.data)}</td>
                  <td className="px-4 py-3">{lancamento.categoria}</td>
                  <td className="px-4 py-3">{lancamento.descricao}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      lancamento.tipo === "receita" ? "text-accent" : "text-status-error"
                    }`}
                  >
                    {lancamento.tipo === "despesa" && "- "}
                    {formatarMoeda(lancamento.valor)}
                  </td>
                  <td className="px-4 py-3">
                    {lancamento.pago ? (
                      <span className="badge bg-accent-light text-accent-dark">Pago</span>
                    ) : (
                      <button type="button" className="badge bg-secondary-light text-brand" onClick={() => marcarPago(lancamento.id)}>
                        Marcar como pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {lancamentos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Nenhum lançamento registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {mostrarNovo && (
        <NovoLancamentoModal
          onFechar={() => setMostrarNovo(false)}
          onCriado={() => {
            setMostrarNovo(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
