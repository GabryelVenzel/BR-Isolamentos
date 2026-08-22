"use client";

import { useCallback, useEffect, useState } from "react";
import AlertsBanner from "@/components/modules/resumo/AlertsBanner";
import CashFlowChart from "@/components/modules/resumo/CashFlowChart";
import FilterBar from "@/components/modules/resumo/FilterBar";
import KPICard, { type CorCard } from "@/components/modules/resumo/KPICard";
import LeadsFunnelChart from "@/components/modules/resumo/LeadsFunnelChart";
import RevenueDistributionChart from "@/components/modules/resumo/RevenueDistributionChart";
import RevenueVsExpenseChart from "@/components/modules/resumo/RevenueVsExpenseChart";
import TopPartnersChart from "@/components/modules/resumo/TopPartnersChart";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import { baixarArquivo, gerarPdfDeElemento } from "@/lib/pdf-generator";
import type {
  AlertaResumo,
  DistribuicaoTipoResumo,
  FiltrosResumo,
  KpisResumo,
  ParceiroTopResumo,
  PontoReceitaDespesa,
  ProjecaoCaixaResumo,
} from "@/lib/types/resumo";
import type { FunilResultado } from "@/lib/usecases/resumo";

const FILTROS_INICIAIS: FiltrosResumo = { periodo: "mes" };

/** Dashboard executivo — visão única de saúde financeira, performance de
 * vendas, gargalos operacionais e alertas críticos. Cada seção busca dados
 * reais das rotas de app/api/resumo/*; ver os comentários em
 * lib/usecases/resumo/*.ts pras decisões de modelagem onde o schema real não
 * tinha exatamente o campo que o pedido original assumia (ex.: não há meta
 * de receita configurada, nem data de vencimento separada em
 * lançamentos financeiros). */
export default function ResumoPage() {
  const [filtros, setFiltros] = useState<FiltrosResumo>(FILTROS_INICIAIS);
  const [kpis, setKpis] = useState<KpisResumo | null>(null);
  const [alertas, setAlertas] = useState<AlertaResumo[]>([]);
  const [receitaVsDespesa, setReceitaVsDespesa] = useState<PontoReceitaDespesa[]>([]);
  const [funil, setFunil] = useState<FunilResultado | null>(null);
  const [distribuicao, setDistribuicao] = useState<DistribuicaoTipoResumo[]>([]);
  const [parceiros, setParceiros] = useState<ParceiroTopResumo[]>([]);
  const [projecao, setProjecao] = useState<ProjecaoCaixaResumo | null>(null);

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
      if (filtros.tipoTrabalho) params.set("tipo", filtros.tipoTrabalho);
      if (filtros.responsavel) params.set("responsavel", filtros.responsavel);
      const qs = params.toString();

      const [rKpis, rAlertas, rReceitaDespesa, rFunil, rDistribuicao, rParceiros, rProjecao] = await Promise.all([
        fetch(`/api/resumo/kpis?${qs}`),
        fetch("/api/resumo/alerts"),
        fetch(`/api/resumo/charts/receita-vs-despesa?${qs}`),
        fetch("/api/resumo/charts/leads-funil"),
        fetch(`/api/resumo/charts/receita-distribuicao?${qs}`),
        fetch("/api/resumo/charts/parceiros-top"),
        fetch("/api/resumo/charts/cashflow-projecao"),
      ]);

      const [pKpis, pAlertas, pReceitaDespesa, pFunil, pDistribuicao, pParceiros, pProjecao] = await Promise.all([
        rKpis.json(),
        rAlertas.json(),
        rReceitaDespesa.json(),
        rFunil.json(),
        rDistribuicao.json(),
        rParceiros.json(),
        rProjecao.json(),
      ]);

      if (!pKpis.success) {
        setErro(pKpis.error ?? "Erro ao carregar os KPIs do dashboard.");
        return;
      }

      setKpis(pKpis.data);
      if (pAlertas.success) setAlertas(pAlertas.data);
      if (pReceitaDespesa.success) setReceitaVsDespesa(pReceitaDespesa.data);
      if (pFunil.success) setFunil(pFunil.data);
      if (pDistribuicao.success) setDistribuicao(pDistribuicao.data);
      if (pParceiros.success) setParceiros(pParceiros.data);
      if (pProjecao.success) setProjecao(pProjecao.data);
      setUltimaAtualizacao(new Date());
    } catch {
      setErro("Erro de conexão ao carregar o dashboard.");
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
      ["Receita", kpis.receita.valor.toFixed(2)],
      ["Leads ativos", String(kpis.leadsAtivos.quantidade)],
      ["Valor em prospecção", kpis.leadsAtivos.valorEmProspeccao.toFixed(2)],
      ["Vendas fechadas", String(kpis.fechados.quantidade)],
      ["Valor fechado", kpis.fechados.valorEstimado.toFixed(2)],
      ["Taxa de conversão (%)", kpis.fechados.taxaConversaoPercentual.toFixed(1)],
      ["A receber", kpis.aReceber.valor.toFixed(2)],
      ["A receber vencido", kpis.aReceber.vencidas.valor.toFixed(2)],
      ["Despesas", kpis.despesas.valor.toFixed(2)],
      ["Custos fixos configurados", kpis.despesas.custosFixosConfigurados.toFixed(2)],
      ["Saldo", kpis.saldo.valor.toFixed(2)],
      ["Margem (%)", kpis.saldo.margemPercentual?.toFixed(1) ?? ""],
    ];
    const csv = linhas.map((linha) => linha.map((valor) => `"${valor.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    baixarArquivo(blob, `Resumo_Executivo_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const corTendenciaReceita: CorCard = kpis
    ? kpis.receita.tendencia.cor === "positiva"
      ? "verde"
      : kpis.receita.tendencia.cor === "negativa"
        ? "vermelho"
        : "amarelo"
    : "neutro";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Resumo</h1>
          <p className="text-sm text-gray-500">Dashboard executivo — saúde financeira, vendas e operação em uma tela.</p>
        </div>
      </div>

      <AlertsBanner alertas={alertas} />

      <FilterBar
        filtros={filtros}
        onChange={setFiltros}
        onExportPdf={exportarPdf}
        onExportCsv={exportarCsv}
        onRefresh={carregar}
        atualizando={carregando || exportandoPdf}
      />

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      {/* 3 KPI cards por linha (2 linhas), não 6 numa linha só: dentro do
          container max-w-6xl, 6 cards lado a lado deixariam ~170px cada —
          pouco pra valores em moeda maiores sem truncar. 3 por linha dobra
          esse espaço e continua cabendo tudo "numa tela só" (pedido
          original) sem exigir rolagem adicional relevante. */}
      <div id="resumo-dashboard-export" className="space-y-6 bg-gray-50">
        {kpis && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              titulo={kpis.periodoLabel === "Este mês" ? "Receita do mês" : "Receita do período"}
              icone="📊"
              valor={formatarMoeda(kpis.receita.valor)}
              cor={corTendenciaReceita}
              tendencia={kpis.receita.tendencia}
              href="/financeiro"
            />

            <KPICard titulo="Leads Ativos" icone="🔄" valor={String(kpis.leadsAtivos.quantidade)} cor="azul" href="/comercial">
              <p>{formatarMoeda(kpis.leadsAtivos.valorEmProspeccao)} em prospecção</p>
              <p>{kpis.leadsAtivos.novosNoPeriodo} novo(s) no período</p>
            </KPICard>

            <KPICard
              titulo="Vendas Fechadas"
              icone="✅"
              valor={String(kpis.fechados.quantidade)}
              cor="verde"
              tendencia={kpis.fechados.tendencia}
              href="/comercial"
            >
              <p>{formatarMoeda(kpis.fechados.valorEstimado)}</p>
              <p>Taxa de conversão: {kpis.fechados.taxaConversaoPercentual.toFixed(1)}%</p>
            </KPICard>

            <KPICard
              titulo="A Receber"
              icone="💰"
              valor={formatarMoeda(kpis.aReceber.valor)}
              cor={kpis.aReceber.vencidas.quantidade > 0 ? "vermelho" : "amarelo"}
              href="/financeiro"
            >
              <p>{kpis.aReceber.quantidadeFaturas} fatura(s) pendente(s)</p>
              {kpis.aReceber.vencidas.quantidade > 0 && (
                <p className="font-semibold text-status-error">
                  ⚠️ {kpis.aReceber.vencidas.quantidade} vencida(s): {formatarMoeda(kpis.aReceber.vencidas.valor)}
                </p>
              )}
            </KPICard>

            <KPICard
              titulo="Despesas"
              icone="💸"
              valor={formatarMoeda(kpis.despesas.valor)}
              cor="vermelho"
              tendencia={kpis.despesas.tendencia}
              href="/financeiro"
            >
              <p>Custos fixos configurados: {formatarMoeda(kpis.despesas.custosFixosConfigurados)}/mês</p>
            </KPICard>

            <KPICard
              titulo="Saldo / Período"
              icone="💵"
              valor={formatarMoeda(kpis.saldo.valor)}
              cor={kpis.saldo.status === "saudavel" ? "verde" : kpis.saldo.status === "atencao" ? "amarelo" : "vermelho"}
              href="/financeiro"
            >
              <p>Margem: {kpis.saldo.margemPercentual !== null ? `${kpis.saldo.margemPercentual.toFixed(1)}%` : "—"}</p>
              <p>
                {kpis.saldo.status === "saudavel" && "✅ Saudável"}
                {kpis.saldo.status === "atencao" && "⚠️ Atenção"}
                {kpis.saldo.status === "critico" && "❌ Crítico"}
              </p>
            </KPICard>
          </div>
        )}

        {carregando && !kpis && <p className="text-sm text-gray-500">Carregando dashboard...</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevenueVsExpenseChart dados={receitaVsDespesa} />
          {funil && <LeadsFunnelChart funil={funil} />}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <RevenueDistributionChart dados={distribuicao} />
          <TopPartnersChart parceiros={parceiros} />
          {projecao && <CashFlowChart projecao={projecao} />}
        </div>
      </div>

      {ultimaAtualizacao && (
        <p className="text-right text-xs text-gray-400">Última atualização: {formatarDataHora(ultimaAtualizacao)}</p>
      )}
    </div>
  );
}
