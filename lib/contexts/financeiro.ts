// Contexto de negócio do módulo Financeiro (contas a pagar/receber, custos
// fixos e notas fiscais) — SCAFFOLDING. O SQL das tabelas
// `lancamentos_financeiros`/`custos_fixos`/`notas_fiscais` já existe em
// sql-migration-004-6modulos-completo.sql, falta aplicar no Supabase e
// implementar repositório/use cases. Ver tipos em `lib/types/domain.ts`.
//
// Nota importante para quando este módulo for implementado: ele NÃO deve
// reimplementar cálculo de impostos — sempre reutilizar
// `lib/tributos.ts`/`lib/usecases/orcamento/calcularOrcamento.ts`, que já
// aplicam a carga tributária real e completa do regime configurado (exigência
// permanente do projeto, não simplificar para um percentual aproximado). Este
// módulo só registra o fluxo de caixa (receita/despesa já com imposto
// aplicado, quando vinculado a um orçamento).

import { NotImplementedError } from "../errors";
import type { LancamentoFinanceiro } from "../types/domain";

const AVISO = "Módulo Financeiro ainda não implementado — aplique sql-migration-004-6modulos-completo.sql e implemente o repositório.";

export function createFinanceiroContext() {
  return {
    async listarPendentes(): Promise<LancamentoFinanceiro[]> {
      throw new NotImplementedError(AVISO);
    },

    async lancar(
      _dados: Omit<LancamentoFinanceiro, "id" | "created_at" | "updated_at" | "pago" | "data_pagamento">
    ): Promise<LancamentoFinanceiro> {
      throw new NotImplementedError(AVISO);
    },

    async marcarComoPago(_id: string): Promise<LancamentoFinanceiro> {
      throw new NotImplementedError(AVISO);
    },
  };
}

export type FinanceiroContext = ReturnType<typeof createFinanceiroContext>;
