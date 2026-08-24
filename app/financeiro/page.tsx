"use client";

import { useCallback, useEffect, useState } from "react";
import ReceitaDespesaChart from "@/components/modules/financeiro/graficos/ReceitaDespesaChart";
import DistribuicaoCategoriaChart from "@/components/modules/financeiro/graficos/DistribuicaoCategoriaChart";
import { formatarMoeda } from "@/lib/format";
import type { ResumoMesAtual } from "@/lib/repositories";
import type {
  AlertaFinanceiro,
  CustosFixosVsVariaveis,
  DistribuicaoCategoria,
  ReceitaDespesaMes,
} from "@/lib/usecases/financeiro";

interface Relatorio {
  distribuicaoReceitas: DistribuicaoCategoria[];
  distribuicaoDespesas: DistribuicaoCategoria[];
  custosFixosVsVariaveis: CustosFixosVsVariaveis;
  receitaVsDespesaPorMes: ReceitaDespesaMes[];
  alertas: AlertaFinanceiro[];
}

export default function FinanceiroDashboardPage() {
  const [resumo, setResumo] = useState<(ResumoMesAtual & { custosFixosMensal: number }) | null>(null);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [respResumo, respRelatorio] = await Promise.all([
        fetch("/api/financeiro/resumo"),
        fetch("/api/financeiro/relatorios?periodo=3meses"),
      ]);
      const [payloadResumo, payloadRelatorio] = await Promise.all([respResumo.json(), respRelatorio.json()]);

      if (!payloadResumo.success) {
        setErro(payloadResumo.error ?? "Erro ao carregar o resumo financeiro.");
        return;
      }
      setResumo(payloadResumo.data);
      if (payloadRelatorio.success) setRelatorio(payloadRelatorio.data);
    } catch {
      setErro("Erro de conexão ao carregar o dashboard financeiro.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const lucroLiquidoEstimado = resumo ? resumo.lucro_bruto - resumo.custosFixosMensal : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-gray-500">Visão geral do fluxo de caixa — receitas, despesas e custos fixos.</p>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : erro || !resumo ? (
        <div className="card text-sm text-status-error">
          <p>{erro ?? "Não foi possível carregar o dashboard."}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
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

          {relatorio && relatorio.alertas.length > 0 && (
            <div className="space-y-2 rounded-card border-l-4 border-l-status-error bg-red-50 p-4">
              <h3 className="font-montserrat text-sm font-bold uppercase text-status-error">🔴 Pendentes</h3>
              {relatorio.alertas.map((a) => (
                <p key={a.tipo} className="text-sm text-status-error">
                  {formatarMoeda(a.valor)} em {a.mensagem}
                </p>
              ))}
            </div>
          )}

          {relatorio && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ReceitaDespesaChart dados={relatorio.receitaVsDespesaPorMes} />
              <DistribuicaoCategoriaChart titulo="Distribuição de Despesas" dados={relatorio.distribuicaoDespesas} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
