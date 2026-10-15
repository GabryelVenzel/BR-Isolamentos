"use client";

import { useCallback, useEffect, useState } from "react";
import { Carregando } from "@/components/ui/Esqueleto";
import FilterBar from "./FilterBar";
import { GraficoFluxoCaixa, IndicadoresCaixa, TabelaAging, TabelaSemanasCaixa } from "./FluxoCaixa";
import { DreTabela, ResultadoObrasTabela } from "./RelatoriosResultado";
import ReceitaDespesaChart from "@/components/modules/financeiro/graficos/ReceitaDespesaChart";
import DistribuicaoCategoriaChart from "@/components/modules/financeiro/graficos/DistribuicaoCategoriaChart";
import CustosFixosVariaveisChart from "@/components/modules/financeiro/graficos/CustosFixosVariaveisChart";
import { gerarPdfDeElemento, baixarArquivo } from "@/lib/pdf-generator";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { FiltrosResumo } from "@/lib/types/resumo";
import type { CustosFixosVsVariaveis, DistribuicaoCategoria, KpisFinanceiro, ReceitaDespesaMes } from "@/lib/usecases/financeiro";
import type { FluxoCaixa } from "@/lib/usecases/resumo";

interface RelatorioFinanceiro {
  kpis: KpisFinanceiro;
  distribuicaoReceitas: DistribuicaoCategoria[];
  distribuicaoDespesas: DistribuicaoCategoria[];
  receitaVsDespesaPorMes: ReceitaDespesaMes[];
}

const FILTROS_INICIAIS: FiltrosResumo = { periodo: "mes_atual" };

/** Aba "Financeira" do Resumo (revisão do Resumo), em duas partes:
 *
 *   CAIXA (não depende do período — é a posição de hoje e o que vem):
 *     caixa hoje, menor saldo previsto, saldo em 30/60/90 dias, a receber
 *     vencido; gráfico do fluxo de caixa por mês ou dia a dia; próximas
 *     semanas; contas em aberto por prazo.
 *
 *   RESULTADO (competência, segue o período escolhido): receita, despesa,
 *     resultado, margem e ponto de equilíbrio; resultado mês a mês; DRE;
 *     resultado por obra; despesas por categoria; custos fixos x variáveis. */
export default function DashboardFinanceira() {
  const [relatorio, setRelatorio] = useState<RelatorioFinanceiro | null>(null);
  const [fluxo, setFluxo] = useState<FluxoCaixa | null>(null);
  const [custos, setCustos] = useState<CustosFixosVsVariaveis | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosResumo>(FILTROS_INICIAIS);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ periodo: filtros.periodo });
      if (filtros.dataInicioCustom) params.set("dataInicio", filtros.dataInicioCustom);
      if (filtros.dataFimCustom) params.set("dataFim", filtros.dataFimCustom);
      const json = (url: string) => fetch(url).then((r) => r.json()).catch(() => ({ success: false }));
      const [pRel, pFluxo, pCustos] = await Promise.all([
        json(`/api/financeiro/relatorios?${params.toString()}`),
        json("/api/resumo/fluxo-caixa"),
        json(`/api/resumo/charts/custos-fixos-variaveis?${params.toString()}`),
      ]);
      if (pRel.success) setRelatorio(pRel.data);
      else setErro(pRel.error ?? "Erro ao carregar o relatório.");
      setFluxo(pFluxo.success ? pFluxo.data : null);
      setCustos(pCustos.success ? pCustos.data : null);
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportarPdf() {
    setExportando(true);
    try {
      const blob = await gerarPdfDeElemento("resumo-financeira-export");
      baixarArquivo(blob, `Resumo_Financeira_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  // Ponto de equilíbrio (estimativa): faturamento mensal que cobre os custos
  // fixos configurados, dada a margem de contribuição do período
  // (receita − despesas variáveis) / receita.
  const receita = relatorio?.kpis.receitaTotal ?? 0;
  const margemContribuicao = custos && receita > 0 ? (receita - custos.variaveis) / receita : null;
  const pontoEquilibrio = relatorio && margemContribuicao && margemContribuicao > 0 ? relatorio.kpis.custosFixosMensal / margemContribuicao : null;

  return (
    <div className="space-y-6">
      <FilterBar filtros={filtros} onChange={setFiltros} onExportPdf={exportarPdf} onRefresh={carregar} atualizando={carregando || exportando} />

      {carregando && !relatorio ? (
        <Carregando linhas={6} />
      ) : erro || !relatorio ? (
        <div className="card text-sm text-status-error">
          <p>{erro ?? "Não foi possível carregar o relatório."}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <div id="resumo-financeira-export" className="space-y-6 bg-gray-50">
          {fluxo && (
            <section className="space-y-4">
              <h2 className="font-montserrat text-base font-bold text-brand">Caixa</h2>
              <IndicadoresCaixa fluxo={fluxo} />
              <GraficoFluxoCaixa fluxo={fluxo} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TabelaSemanasCaixa fluxo={fluxo} />
                <TabelaAging fluxo={fluxo} />
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div>
              <h2 className="font-montserrat text-base font-bold text-brand">Resultado do período (competência)</h2>
              <p className="text-xs text-gray-500">Inclui as projeções vigentes (Financeiro → Projeção); o resultado por obra considera só o realizado.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Indicador titulo="Receitas" valor={formatarMoeda(relatorio.kpis.receitaTotal)} cor="text-accent" />
              <Indicador titulo="Despesas" valor={formatarMoeda(relatorio.kpis.despesaTotal)} cor="text-status-error" />
              <Indicador
                titulo="Resultado"
                valor={formatarMoeda(relatorio.kpis.lucroLiquido)}
                cor={relatorio.kpis.lucroLiquido < 0 ? "text-status-error" : "text-brand"}
              />
              <Indicador titulo="Margem" valor={relatorio.kpis.margemPercentual != null ? `${formatarNumero(relatorio.kpis.margemPercentual, 1)}%` : "—"} cor="text-brand" />
              <Indicador
                titulo="Ponto de equilíbrio"
                valor={pontoEquilibrio != null ? formatarMoeda(pontoEquilibrio) : "—"}
                cor="text-brand"
                detalhe={`Faturamento/mês que cobre ${formatarMoeda(relatorio.kpis.custosFixosMensal)} de custos fixos`}
              />
            </div>

            <ReceitaDespesaChart dados={relatorio.receitaVsDespesaPorMes} />
            <DreTabela filtros={filtros} />
            <ResultadoObrasTabela />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <DistribuicaoCategoriaChart titulo="Despesas por categoria" dados={relatorio.distribuicaoDespesas} />
              <DistribuicaoCategoriaChart titulo="Receitas por categoria" dados={relatorio.distribuicaoReceitas} />
              {custos && <CustosFixosVariaveisChart dados={custos} />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Indicador({ titulo, valor, cor, detalhe }: { titulo: string; valor: string; cor: string; detalhe?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 truncate font-montserrat text-lg font-bold sm:text-xl ${cor}`} title={valor}>
        {valor}
      </p>
      {detalhe && <p className="text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
}
