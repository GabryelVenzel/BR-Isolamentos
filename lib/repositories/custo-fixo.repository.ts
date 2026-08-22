import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustoFixo } from "../types/domain";
import { BaseRepository } from "./base";

export class CustoFixoRepository extends BaseRepository<CustoFixo> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "custos_fixos");
  }

  async listarTodos(): Promise<CustoFixo[]> {
    return this.findAll({ orderBy: "categoria" });
  }

  /** Soma de `valor_mensal` dos custos fixos ativos — usada no resumo do
   * dashboard financeiro junto com `v_financeiro_mes_atual`. */
  async totalMensalAtivo(): Promise<number> {
    const { data, error } = await this.queryBuilder().select("valor_mensal").eq("ativo", true);
    if (error) throw error;
    return ((data ?? []) as Array<{ valor_mensal: number }>).reduce((acc, c) => acc + c.valor_mensal, 0);
  }
}
