// Contexto de negócio do módulo Resumo (dashboard executivo cruzando
// Comercial, Operacional e Financeiro). Ponto único de import para as rotas
// de app/api/resumo/* — reúne os repositórios dos outros módulos e os use
// cases de `lib/usecases/resumo` atrás de uma fachada injetada com o client
// do Supabase da requisição atual. Mesmo padrão de `lib/contexts/orcamento.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AgendamentoRepository,
  CustoFixoRepository,
  LancamentoFinanceiroRepository,
  LeadRepository,
  OrcamentoRepository,
  ParceiroRepository,
} from "../repositories";
import type { FiltrosResumo, KpisResumo } from "../types/resumo";
import { hojeBrasilia } from "../financeiro";
import { projecoesComoLancamentos } from "../projecoes";
import {
  calcularKpis,
  funilLeads,
  listarAlertas,
  calcularFluxoCaixa,
  type FluxoCaixa,
  receitaVsDespesa,
  resolverPeriodo,
} from "../usecases/resumo";
import { calcularCustosFixosVsVariaveis } from "../usecases/financeiro";

export function createResumoContext(supabase: SupabaseClient) {
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);
  const custoFixoRepo = new CustoFixoRepository(supabase);
  const leadRepo = new LeadRepository(supabase);
  const parceiroRepo = new ParceiroRepository(supabase);
  const agendamentoRepo = new AgendamentoRepository(supabase);
  const orcamentoRepo = new OrcamentoRepository(supabase);

  /** Fluxo de caixa a partir do saldo inicial (migração 053). Antes do SQL
   * 053 rodar, as colunas não existem: cai no padrão (R$ 0 em 28/09/2026). */
  async function fluxoCaixa(): Promise<FluxoCaixa> {
    const [lancamentos, custosFixos, config] = await Promise.all([
      lancamentoRepo.listar().then(async (l) => [...l, ...(await projecoesComoLancamentos(supabase))]),
      custoFixoRepo.listarTodos(),
      supabase.from("config_empresa").select("caixa_data_inicial, caixa_saldo_inicial").limit(1).maybeSingle(),
    ]);
    const cfg = (config.error ? null : config.data) as { caixa_data_inicial?: string; caixa_saldo_inicial?: number } | null;
    return calcularFluxoCaixa({
      lancamentos,
      custosFixos,
      saldoInicial: Number(cfg?.caixa_saldo_inicial ?? 0),
      dataInicial: cfg?.caixa_data_inicial ?? "2026-09-28",
      hoje: hojeBrasilia(),
    });
  }

  return {
    async kpis(filtros: FiltrosResumo): Promise<KpisResumo> {
      return calcularKpis(filtros, { lancamentoRepo, leadRepo, custoFixoRepo }, await projecoesComoLancamentos(supabase));
    },

    async alertas(): Promise<Awaited<ReturnType<typeof listarAlertas>>> {
      // Mesmo fluxo de caixa do gráfico, para o alerta de "caixa negativo".
      const fluxo = await fluxoCaixa();
      const diasNegativos = fluxo.primeiroDiaNegativo
        ? {
            primeiroDiaNegativo: Math.max(1, fluxo.diario.findIndex((d) => d.data === fluxo.primeiroDiaNegativo)),
            totalDiasNegativos: fluxo.diario.filter((d) => d.saldo < 0).length,
          }
        : null;
      return listarAlertas({ lancamentoRepo, leadRepo, parceiroRepo }, diasNegativos);
    },

    async chartReceitaVsDespesa(opts: { tipoTrabalho?: string; responsavel?: string } = {}) {
      return receitaVsDespesa(lancamentoRepo, opts, 6, await projecoesComoLancamentos(supabase));
    },

    chartFunilLeads() {
      return funilLeads(leadRepo);
    },

    fluxoCaixa,

    // Pedido explícito (rodada "inverter gráficos de aba"): Custos Fixos x
    // Variáveis passou da aba Financeira pra Geral — mesmo cálculo
    // (lib/usecases/financeiro/relatorio.ts), só que filtrado pelo período da
    // FilterBar do Resumo (Financeira já fazia isso dentro de
    // /api/financeiro/relatorios; aqui tira o lançamento do período direto).
    async chartCustosFixosVsVariaveis(filtros: FiltrosResumo) {
      const intervalo = resolverPeriodo(filtros.periodo, filtros.dataInicioCustom, filtros.dataFimCustom);
      const [lancamentos, previstos] = await Promise.all([
        lancamentoRepo.listar({ dataInicio: intervalo.dataInicio, dataFim: intervalo.dataFim, porCompetencia: true }),
        projecoesComoLancamentos(supabase, intervalo.dataInicio, intervalo.dataFim),
      ]);
      return calcularCustosFixosVsVariaveis([...lancamentos, ...previstos]);
    },
  };
}

export type ResumoContext = ReturnType<typeof createResumoContext>;
