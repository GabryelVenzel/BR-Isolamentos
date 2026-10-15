// Projeções financeiras (migração 054) nos cálculos do Resumo: cada
// projeção vira um lançamento "em aberto" com vencimento e competência na
// data dela. Só as vigentes (vencimento hoje ou depois) — as vencidas deixam
// de contar sozinhas. Ficam FORA de Lançamentos e do resultado por obra.

import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeBrasilia } from "./financeiro";
import { logger } from "./logger";
import { ProjecaoFinanceiraRepository } from "./repositories/projecao-financeira.repository";
import type { LancamentoFinanceiro, ProjecaoFinanceira } from "./types/domain";

export function projecaoComoLancamento(p: ProjecaoFinanceira): LancamentoFinanceiro {
  return {
    id: `projecao-${p.id}`,
    tipo: p.tipo,
    categoria: p.categoria,
    descricao: p.descricao,
    valor: Number(p.valor),
    data: p.data,
    data_competencia: p.data,
    pago: false,
    data_pagamento: null,
    forma_pagamento: null,
    fornecedor_id: null,
    parceiro_id: null,
    funcionario_id: null,
    grupo_id: null,
    grupo_tipo: null,
    parcela_numero: null,
    parcela_total: null,
    orcamento_id: null,
    arquivo_url: null,
    anexos: [],
    servico_id: null,
    lead_id: null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  } as unknown as LancamentoFinanceiro;
}

/** Projeções vigentes como lançamentos previstos, opcionalmente só as que
 * vencem entre `inicio` e `fim`. Sem a tabela (SQL 054 não rodado) ou sem
 * acesso, devolve vazio — o dashboard segue só com os lançamentos. */
export async function projecoesComoLancamentos(supabase: SupabaseClient, inicio?: string, fim?: string): Promise<LancamentoFinanceiro[]> {
  try {
    const hoje = hojeBrasilia();
    const lista = await new ProjecaoFinanceiraRepository(supabase).listarVigentes(inicio && inicio > hoje ? inicio : hoje, fim);
    return lista.map(projecaoComoLancamento);
  } catch (error) {
    logger.warn("Projeções financeiras indisponíveis", { error: String((error as Error)?.message ?? error) });
    return [];
  }
}
