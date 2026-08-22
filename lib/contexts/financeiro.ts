// Contexto de negócio do módulo Financeiro (contas a pagar/receber vinculadas
// a orçamentos) — SCAFFOLDING. Tabela `itens_financeiros` ainda não existe.
// Ver `ItemFinanceiro` em `lib/types/domain.ts`.
//
// Nota importante para quando este módulo for implementado: ele NÃO deve
// reimplementar cálculo de impostos — sempre reutilizar
// `lib/tributos.ts`/`lib/usecases/orcamento/calcularOrcamento.ts`, que já
// aplicam a carga tributária real e completa do regime configurado (exigência
// permanente do projeto, não simplificar para um percentual aproximado).

import { NotImplementedError } from "../errors";
import type { ItemFinanceiro } from "../types/domain";

const AVISO = "Módulo Financeiro ainda não implementado — tabela `itens_financeiros` pendente.";

export function createFinanceiroContext() {
  return {
    async listarPendentes(): Promise<ItemFinanceiro[]> {
      throw new NotImplementedError(AVISO);
    },

    async lancar(
      _dados: Omit<ItemFinanceiro, "id" | "created_at" | "updated_at" | "status">
    ): Promise<ItemFinanceiro> {
      throw new NotImplementedError(AVISO);
    },

    async marcarComoPago(_id: string): Promise<ItemFinanceiro> {
      throw new NotImplementedError(AVISO);
    },
  };
}

export type FinanceiroContext = ReturnType<typeof createFinanceiroContext>;
