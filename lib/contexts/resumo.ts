// Contexto de negócio do módulo Resumo (dashboards executivos cruzando os
// demais módulos) — SCAFFOLDING. Depende dos outros 5 módulos existirem (ao
// menos Orçamento, que já está pronto) para agregar métricas reais.
//
// A única métrica hoje disponível sem depender de módulo pendente é o resumo
// de orçamentos por status, então essa função já é implementada de verdade
// como exemplo do padrão a seguir quando os outros módulos saírem do
// scaffolding.

import type { SupabaseClient } from "@supabase/supabase-js";
import { NotImplementedError } from "../errors";
import { OrcamentoRepository } from "../repositories";
import type { StatusOrcamento } from "../types";

export interface ResumoOrcamentosPorStatus {
  status: StatusOrcamento;
  quantidade: number;
  valorTotal: number;
}

export function createResumoContext(supabase: SupabaseClient) {
  const orcamentoRepo = new OrcamentoRepository(supabase);

  return {
    async orcamentosPorStatus(): Promise<ResumoOrcamentosPorStatus[]> {
      const orcamentos = await orcamentoRepo.findAll();
      const porStatus = new Map<StatusOrcamento, ResumoOrcamentosPorStatus>();

      for (const orcamento of orcamentos) {
        const atual = porStatus.get(orcamento.status) ?? {
          status: orcamento.status,
          quantidade: 0,
          valorTotal: 0,
        };
        atual.quantidade += 1;
        atual.valorTotal += orcamento.valor_final;
        porStatus.set(orcamento.status, atual);
      }

      return Array.from(porStatus.values());
    },

    /** Métricas cruzando Comercial (funil) + Financeiro (inadimplência) — aguarda
     * esses módulos saírem do scaffolding (ver `lib/contexts/comercial.ts` e
     * `lib/contexts/financeiro.ts`). */
    async funilConversao(): Promise<never> {
      throw new NotImplementedError(
        "Resumo de conversão do funil depende do módulo Comercial, ainda não implementado."
      );
    },
  };
}

export type ResumoContext = ReturnType<typeof createResumoContext>;
