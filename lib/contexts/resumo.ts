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
import type { FiltrosResumo, KpisResumo, ProjecaoCaixaResumo } from "../types/resumo";
import {
  calcularKpis,
  distribuicaoPorTipo,
  funilLeads,
  listarAlertas,
  projecaoCaixa,
  receitaVsDespesa,
  resolverPeriodo,
  topParceiros,
} from "../usecases/resumo";

export function createResumoContext(supabase: SupabaseClient) {
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);
  const custoFixoRepo = new CustoFixoRepository(supabase);
  const leadRepo = new LeadRepository(supabase);
  const parceiroRepo = new ParceiroRepository(supabase);
  const agendamentoRepo = new AgendamentoRepository(supabase);
  const orcamentoRepo = new OrcamentoRepository(supabase);

  return {
    kpis(filtros: FiltrosResumo): Promise<KpisResumo> {
      return calcularKpis(filtros, { lancamentoRepo, leadRepo, custoFixoRepo });
    },

    async alertas(): Promise<Awaited<ReturnType<typeof listarAlertas>>> {
      // Reaproveita a mesma projeção de caixa do gráfico pro alerta de
      // "caixa negativo", em vez de calcular duas vezes.
      const projecao = await projecaoCaixa(lancamentoRepo, custoFixoRepo);
      const diasNegativos = projecao.primeiroDiaNegativo
        ? {
            primeiroDiaNegativo: projecao.dias.findIndex((d) => d.data === projecao.primeiroDiaNegativo) + 1,
            totalDiasNegativos: projecao.diasNegativos,
          }
        : null;
      return listarAlertas({ lancamentoRepo, leadRepo, parceiroRepo }, diasNegativos);
    },

    chartReceitaVsDespesa(opts: { tipoTrabalho?: string; responsavel?: string } = {}) {
      return receitaVsDespesa(lancamentoRepo, opts);
    },

    chartFunilLeads() {
      return funilLeads(leadRepo);
    },

    chartDistribuicaoTipo(filtros: FiltrosResumo) {
      const intervalo = resolverPeriodo(filtros.periodo, filtros.dataInicioCustom, filtros.dataFimCustom);
      return distribuicaoPorTipo(orcamentoRepo, intervalo, filtros.responsavel);
    },

    chartTopParceiros() {
      return topParceiros(parceiroRepo, agendamentoRepo);
    },

    chartProjecaoCaixa(): Promise<ProjecaoCaixaResumo> {
      return projecaoCaixa(lancamentoRepo, custoFixoRepo);
    },
  };
}

export type ResumoContext = ReturnType<typeof createResumoContext>;
