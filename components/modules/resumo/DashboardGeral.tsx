"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, HardHat, RefreshCw, Scale, Wallet } from "lucide-react";
import AlertsBanner from "@/components/modules/resumo/AlertsBanner";
import FilterBar from "@/components/modules/resumo/FilterBar";
import KPICard, { type CorCard } from "@/components/modules/resumo/KPICard";
import LeadsFunnelChart from "@/components/modules/resumo/LeadsFunnelChart";
import RevenueVsExpenseChart from "@/components/modules/resumo/RevenueVsExpenseChart";
import { GraficoFluxoCaixa } from "@/components/modules/resumo/FluxoCaixa";
import { EsqueletoCartao } from "@/components/ui/Esqueleto";
import { hojeBrasilia } from "@/lib/financeiro";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/format";
import { baixarArquivo, gerarPdfDeElemento } from "@/lib/pdf-generator";
import type { AlertaResumo, FiltrosResumo, KpisResumo, PontoReceitaDespesa } from "@/lib/types/resumo";
import type { Servico } from "@/lib/types/domain";
import type { FluxoCaixa } from "@/lib/usecases/resumo";
import type { FunilResultado } from "@/lib/usecases/resumo";

const FILTROS_INICIAIS: FiltrosResumo = { periodo: "mes_atual" };

/** Aba "Geral" do Resumo — uma tela para decidir (revisão do Resumo):
 *
 *   1. Alertas críticos.
 *   2. Seis indicadores: caixa hoje (e o menor saldo previsto), resultado do
 *      período (competência) com margem, faturamento, vendas fechadas,
 *      pipeline em aberto e obras em execução/atrasadas.
 *   3. Fluxo de caixa — o gráfico principal (por mês ou dia a dia, 90 dias).
 *   4. Resultado mês a mês e funil de vendas.
 *
 * O detalhe de cada área fica nas abas Financeira, Comercial e Operação.
 * Saíram daqui (eram detalhe, não decisão): receita por tipo quente/frio,
 * top parceiros e custos fixos x variáveis (este foi para a Financeira). */
export default function DashboardGeral() {
  const [filtros, setFiltros] = useState<FiltrosResumo>(FILTROS_INICIAIS);
  const [kpis, setKpis] = useState<KpisResumo | null>(null);
  const [fluxo, setFluxo] = useState<FluxoCaixa | null>(null);
  const [obras, setObras] = useState<{ execucao: number; atrasadas: number; planejadas: number } | null>(null);
  const [alertas, setAlertas] = useState<AlertaResumo[]>([]);
  const [receitaVsDespesa, setReceitaVsDespesa] = useState<PontoReceitaDespesa[]>([]);
  const [funil, setFunil] = useState<FunilResultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ periodo: filtros.periodo });
      if (filtros.dataInicioCustom) params.set("dataInicio", filtros.dataInicioCustom);
      if (filtros.dataFimCustom) params.set("dataFim", filtros.dataFimCustom);
      const qs = params.toString();
      const json = (url: string) => fetch(url).then((r) => r.json()).catch(() => ({ success: false }));

      const [pKpis, pFluxo, pServicos, pAlertas, pReceitaDespesa, pFunil] = await Promise.all([
        json(`/api/resumo/kpis?${qs}`),
        json("/api/resumo/fluxo-caixa"),
        json("/api/operacional/servicos"),
        json("/api/resumo/alerts"),
        json(`/api/resumo/charts/receita-vs-despesa?${qs}`),
        json("/api/resumo/charts/leads-funil"),
      ]);

      if (!pKpis.success) {
        setErro(pKpis.error ?? "Erro ao carregar os indicadores.");
        return;
      }
      setKpis(pKpis.data);
      setFluxo(pFluxo.success ? pFluxo.data : null);
      if (pServicos.success) {
        const hoje = hojeBrasilia();
        const lista = pServicos.data as Servico[];
        setObras({
          execucao: lista.filter((s) => s.etapa === "execucao").length,
          planejadas: lista.filter((s) => s.etapa === "planejamento").length,
          atrasadas: lista.filter((s) => s.etapa !== "finalizado" && s.data_fim_prevista && s.data_fim_prevista < hoje).length,
        });
      } else setObras(null);
      if (pAlertas.success) setAlertas(pAlertas.data);
      if (pReceitaDespesa.success) setReceitaVsDespesa(pReceitaDespesa.data);
      if (pFunil.success) setFunil(pFunil.data);
      setUltimaAtualizacao(new Date());
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportarPdf() {
    setExportandoPdf(true);
    try {
      const blob = await gerarPdfDeElemento("resumo-dashboard-export");
      baixarArquivo(blob, `Resumo_Executivo_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      setErro("Não foi possível gerar o PDF do dashboard.");
    } finally {
      setExportandoPdf(false);
    }
  }

  function exportarCsv() {
    if (!kpis) return;
    const linhas: string[][] = [
      ["Métrica", "Valor"],
      ["Período", kpis.periodoLabel],
      ["Caixa hoje", fluxo ? fluxo.saldoHoje.toFixed(2) : ""],
      ["Menor saldo previsto (90 dias)", fluxo ? fluxo.menorSaldo.valor.toFixed(2) : ""],
      ["Faturamento (competência)", kpis.receita.valor.toFixed(2)],
      ["Despesas (competência)", kpis.despesas.valor.toFixed(2)],
      ["Resultado", kpis.saldo.valor.toFixed(2)],
      ["Margem (%)", kpis.saldo.margemPercentual?.toFixed(1) ?? ""],
      ["Vendas fechadas", String(kpis.fechados.quantidade)],
      ["Valor fechado", kpis.fechados.valorEstimado.toFixed(2)],
      ["Taxa de conversão (%)", kpis.fechados.taxaConversaoPercentual.toFixed(1)],
      ["Pipeline em aberto", kpis.leadsAtivos.valorEmAberto.toFixed(2)],
      ["Obras em execução", obras ? String(obras.execucao) : ""],
      ["Obras atrasadas", obras ? String(obras.atrasadas) : ""],
    ];
    const csv = linhas.map((linha) => linha.map((valor) => `"${valor.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    baixarArquivo(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" }), `Resumo_Executivo_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const cor = (c: "positiva" | "negativa" | "neutra"): CorCard => (c === "positiva" ? "verde" : c === "negativa" ? "vermelho" : "amarelo");
  const caixaEmRisco = fluxo ? fluxo.saldoHoje < 0 || fluxo.primeiroDiaNegativo !== null : false;

  return (
    <div className="space-y-6">
      <AlertsBanner alertas={alertas} />

      <FilterBar filtros={filtros} onChange={setFiltros} onExportPdf={exportarPdf} onExportCsv={exportarCsv} onRefresh={carregar} atualizando={carregando || exportandoPdf} />

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      <div id="resumo-dashboard-export" className="space-y-6 bg-gray-50">
        {!kpis ? (
          carregando && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <EsqueletoCartao key={i} linhas={3} />
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              titulo="Caixa hoje"
              icone={<Wallet className="icone" aria-hidden />}
              valor={fluxo ? formatarMoeda(fluxo.saldoHoje) : "—"}
              cor={!fluxo ? "neutro" : caixaEmRisco ? "vermelho" : "verde"}
              href="/resumo?tab=financeira"
            >
              {fluxo && (
                <>
                  <p>
                    Menor saldo em 90 dias: <strong>{formatarMoeda(fluxo.menorSaldo.valor)}</strong> ({formatarData(fluxo.menorSaldo.data)})
                  </p>
                  {fluxo.primeiroDiaNegativo && <p className="font-semibold text-status-error">Fica negativo em {formatarData(fluxo.primeiroDiaNegativo)}</p>}
                  {fluxo.aReceberVencido.valor > 0 && <p>A receber vencido (risco): {formatarMoeda(fluxo.aReceberVencido.valor)}</p>}
                </>
              )}
            </KPICard>

            <KPICard
              titulo="Resultado do período"
              icone={<Scale className="icone" aria-hidden />}
              valor={formatarMoeda(kpis.saldo.valor)}
              cor={kpis.saldo.status === "saudavel" ? "verde" : kpis.saldo.status === "atencao" ? "amarelo" : "vermelho"}
              href="/resumo?tab=financeira"
            >
              <p>Margem: {kpis.saldo.margemPercentual !== null ? `${kpis.saldo.margemPercentual.toFixed(1)}%` : "—"}</p>
              <p>
                Receitas {formatarMoeda(kpis.receita.valor)} − despesas {formatarMoeda(kpis.despesas.valor)} (competência)
              </p>
            </KPICard>

            <KPICard
              titulo="Faturamento"
              icone={<BarChart3 className="icone" aria-hidden />}
              valor={formatarMoeda(kpis.receita.valor)}
              cor={cor(kpis.receita.tendencia.cor)}
              tendencia={kpis.receita.tendencia}
              href="/financeiro/lancamentos"
            >
              <p>Receitas do período pela competência</p>
            </KPICard>

            <KPICard
              titulo="Vendas fechadas"
              icone={<CheckCircle2 className="icone" aria-hidden />}
              valor={formatarMoeda(kpis.fechados.valorEstimado)}
              cor="verde"
              tendencia={kpis.fechados.tendencia}
              href="/resumo?tab=comercial"
            >
              <p>
                {kpis.fechados.quantidade} venda(s) · conversão {kpis.fechados.taxaConversaoPercentual.toFixed(1)}%
              </p>
            </KPICard>

            <KPICard titulo="Pipeline em aberto" icone={<RefreshCw className="icone" aria-hidden />} valor={formatarMoeda(kpis.leadsAtivos.valorEmAberto)} cor="azul" href="/comercial">
              <p>
                {kpis.leadsAtivos.quantidade} lead(s) em andamento · {kpis.leadsAtivos.novosNoPeriodo} novo(s) no período
              </p>
            </KPICard>

            <KPICard
              titulo="Obras"
              icone={<HardHat className="icone" aria-hidden />}
              valor={obras ? `${obras.execucao} em execução` : "—"}
              cor={!obras ? "neutro" : obras.atrasadas > 0 ? "vermelho" : "azul"}
              href="/operacional/servicos"
            >
              {obras && (
                <p>
                  {obras.planejadas} planejada(s) ·{" "}
                  <span className={obras.atrasadas > 0 ? "font-semibold text-status-error" : ""}>{obras.atrasadas} atrasada(s)</span>
                </p>
              )}
            </KPICard>
          </div>
        )}

        {fluxo && <GraficoFluxoCaixa fluxo={fluxo} />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevenueVsExpenseChart dados={receitaVsDespesa} />
          {funil && <LeadsFunnelChart funil={funil} />}
        </div>
      </div>

      {ultimaAtualizacao && <p className="text-right text-xs text-gray-400">Última atualização: {formatarDataHora(ultimaAtualizacao)}</p>}
    </div>
  );
}
