// Contexto de negócio do módulo Financeiro (lançamentos de receita/despesa,
// custos fixos). Ponto único de import para telas e API routes — reúne os
// repositórios e os use cases de `lib/usecases/financeiro` atrás de uma
// fachada injetada com o client do Supabase da requisição atual. Mesmo
// padrão de `lib/contexts/orcamento.ts`.
//
// IMPORTANTE: este módulo nunca recalcula imposto — o imposto de um
// orçamento já foi calculado e gravado em `orcamentos.detalhamento_impostos`
// na hora da venda (ver lib/tributos.ts); aqui só se registra o fluxo de caixa.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CustoFixoRepository,
  LancamentoFinanceiroRepository,
  type FiltrosLancamento,
  type ResumoMesAtual,
} from "../repositories";
import type { CustoFixo, LancamentoFinanceiro } from "../types/domain";
import { criarCustoFixo, criarLancamento, marcarComoPago } from "../usecases/financeiro";

export function createFinanceiroContext(supabase: SupabaseClient) {
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);
  const custoFixoRepo = new CustoFixoRepository(supabase);

  return {
    lancamentoRepo,
    custoFixoRepo,

    listarLancamentos(filtros?: FiltrosLancamento): Promise<LancamentoFinanceiro[]> {
      return lancamentoRepo.listar(filtros);
    },

    buscarLancamento(id: string): Promise<LancamentoFinanceiro> {
      return lancamentoRepo.findByIdOrThrow(id);
    },

    criarLancamento(dados: unknown): Promise<LancamentoFinanceiro> {
      return criarLancamento(dados, { lancamentoRepo });
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

    listarCustosFixos(): Promise<CustoFixo[]> {
      return custoFixoRepo.listarTodos();
    },

    criarCustoFixo(dados: unknown): Promise<CustoFixo> {
      return criarCustoFixo(dados, { custoFixoRepo });
    },

    atualizarCustoFixo(id: string, dados: Partial<CustoFixo>): Promise<CustoFixo> {
      return custoFixoRepo.update(id, dados);
    },
  };
}

export type FinanceiroContext = ReturnType<typeof createFinanceiroContext>;
