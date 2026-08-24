import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoriaLancamento, TipoLancamentoFinanceiro } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosCategoriaLancamento {
  tipo?: TipoLancamentoFinanceiro;
  ativo?: boolean;
}

export class CategoriaLancamentoRepository extends BaseRepository<CategoriaLancamento> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "categorias_lancamentos");
  }

  async listar(filtros: FiltrosCategoriaLancamento = {}): Promise<CategoriaLancamento[]> {
    let query = this.queryBuilder().select(this.select).order("tipo").order("nome");

    if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
    if (filtros.ativo !== undefined) query = query.eq("ativo", filtros.ativo);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as CategoriaLancamento[];
  }

  /** Quantos lançamentos usam essa categoria (por nome, texto livre — ver
   * decisão 2 na migração 009) — base da validação "não deletar categoria
   * com lançamentos". */
  async contarLancamentosComCategoria(nome: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("lancamentos_financeiros")
      .select("id", { count: "exact", head: true })
      .eq("categoria", nome);

    if (error) throw error;
    return count ?? 0;
  }
}
