// Contexto de negócio do módulo Financeiro (lançamentos de receita/despesa,
// custos fixos, categorias centralizadas, configuração do ciclo). Ponto
// único de import para telas e API routes — reúne os repositórios e os use
// cases de `lib/usecases/financeiro` atrás de uma fachada injetada com o
// client do Supabase da requisição atual. Mesmo padrão de
// `lib/contexts/orcamento.ts`.
//
// IMPORTANTE: este módulo nunca recalcula imposto — o imposto de um
// orçamento já foi calculado e gravado em `orcamentos.detalhamento_impostos`
// na hora da venda (ver lib/tributos.ts); aqui só se registra o fluxo de caixa.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CategoriaLancamentoRepository,
  ConfigFinanceiroRepository,
  CustoFixoRepository,
  HistoricoCustoFixoRepository,
  LancamentoFinanceiroRepository,
  type FiltrosCategoriaLancamento,
  type FiltrosLancamento,
  type ResumoMesAtual,
} from "../repositories";
import type {
  CategoriaLancamento,
  ConfigFinanceiro,
  CustoFixo,
  HistoricoCustoFixo,
  LancamentoFinanceiro,
} from "../types/domain";
import {
  atualizarCategoria,
  criarCategoria,
  criarCustoFixo,
  criarLancamento,
  garantirHistoricoMesAtual,
  marcarComoPago,
  marcarCustoFixoPago,
  removerCategoria,
} from "../usecases/financeiro";

export function createFinanceiroContext(supabase: SupabaseClient) {
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);
  const custoFixoRepo = new CustoFixoRepository(supabase);
  const historicoCustoFixoRepo = new HistoricoCustoFixoRepository(supabase);
  const categoriaRepo = new CategoriaLancamentoRepository(supabase);
  const configRepo = new ConfigFinanceiroRepository(supabase);

  const reposCustoFixo = { custoFixoRepo, historicoRepo: historicoCustoFixoRepo, lancamentoRepo };

  return {
    lancamentoRepo,
    custoFixoRepo,
    historicoCustoFixoRepo,
    categoriaRepo,
    configRepo,

    // --- Lançamentos ---

    listarLancamentos(filtros?: FiltrosLancamento): Promise<LancamentoFinanceiro[]> {
      return lancamentoRepo.listar(filtros);
    },

    buscarLancamento(id: string): Promise<LancamentoFinanceiro> {
      return lancamentoRepo.findByIdOrThrow(id);
    },

    criarLancamento(dados: unknown): Promise<LancamentoFinanceiro> {
      return criarLancamento(dados, { lancamentoRepo });
    },

    atualizarLancamento(id: string, dados: Partial<LancamentoFinanceiro>): Promise<LancamentoFinanceiro> {
      return lancamentoRepo.update(id, dados);
    },

    marcarComoPago(id: string, dataPagamento?: string): Promise<LancamentoFinanceiro> {
      return marcarComoPago(id, dataPagamento, { lancamentoRepo });
    },

    removerLancamento(id: string): Promise<void> {
      return lancamentoRepo.delete(id);
    },

    async resumoMesAtual(): Promise<ResumoMesAtual & { custosFixosMensal: number }> {
      const [resumo, custosFixosMensal] = await Promise.all([
        lancamentoRepo.resumoMesAtual(),
        custoFixoRepo.totalMensalAtivo(),
      ]);
      return { ...resumo, custosFixosMensal };
    },

    // --- Custos fixos ---

    listarCustosFixos(): Promise<CustoFixo[]> {
      return custoFixoRepo.listarTodos();
    },

    /** Roda o sweep de histórico do mês atual antes de listar (ver
     * garantirHistoricoMesAtual.ts) — sem isso, "próximo pagamento"/
     * histórico do card ficariam vazios até algum outro gatilho criar a
     * linha. */
    async listarCustosFixosComHistoricoAtualizado(): Promise<CustoFixo[]> {
      await garantirHistoricoMesAtual(reposCustoFixo);
      return custoFixoRepo.listarTodos();
    },

    criarCustoFixo(dados: unknown): Promise<CustoFixo> {
      return criarCustoFixo(dados, { custoFixoRepo });
    },

    atualizarCustoFixo(id: string, dados: Partial<CustoFixo>): Promise<CustoFixo> {
      return custoFixoRepo.update(id, dados);
    },

    removerCustoFixo(id: string): Promise<void> {
      return custoFixoRepo.delete(id);
    },

    listarHistoricoCustoFixo(custoFixoId: string): Promise<HistoricoCustoFixo[]> {
      return historicoCustoFixoRepo.listarPorCustoFixo(custoFixoId);
    },

    marcarCustoFixoPago(custoFixoId: string, dados: unknown) {
      return marcarCustoFixoPago(custoFixoId, dados, reposCustoFixo);
    },

    // --- Categorias ---

    listarCategorias(filtros?: FiltrosCategoriaLancamento): Promise<CategoriaLancamento[]> {
      return categoriaRepo.listar(filtros);
    },

    criarCategoria(dados: unknown): Promise<CategoriaLancamento> {
      return criarCategoria(dados, { categoriaRepo });
    },

    atualizarCategoria(id: string, dados: unknown): Promise<CategoriaLancamento> {
      return atualizarCategoria(id, dados, { categoriaRepo });
    },

    removerCategoria(id: string): Promise<void> {
      return removerCategoria(id, { categoriaRepo });
    },

    // --- Configuração ---

    obterConfig(): Promise<ConfigFinanceiro> {
      return configRepo.obter();
    },

    atualizarConfig(dados: Partial<ConfigFinanceiro>): Promise<ConfigFinanceiro> {
      return configRepo.atualizar(dados);
    },
  };
}

export type FinanceiroContext = ReturnType<typeof createFinanceiroContext>;
