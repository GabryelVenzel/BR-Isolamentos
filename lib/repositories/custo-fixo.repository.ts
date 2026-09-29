import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustoFixo } from "../types/domain";
import { BaseRepository } from "./base";

export class CustoFixoRepository extends BaseRepository<CustoFixo> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "custos_fixos");
  }

  // Bug relatado: ordenar por "categoria" não fazia mais sentido depois que
  // ela virou um rótulo fixo e igual pra todo mundo ("Custo fixo", ver
  // migração 035) — a lista ficava em ordem arbitrária. "descricao" é o
  // campo livre que hoje distingue cada custo (ex.: "IA Claude", "Aluguel").
  async listarTodos(): Promise<CustoFixo[]> {
    return this.findAll({ orderBy: "descricao" });
  }

  /** Soma de `valor_mensal` dos custos fixos ativos — usada no resumo do
   * dashboard financeiro junto com `v_financeiro_mes_atual`. */
  async totalMensalAtivo(): Promise<number> {
    const { data, error } = await this.queryBuilder().select("valor_mensal").eq("ativo", true);
    if (error) throw error;
    return ((data ?? []) as Array<{ valor_mensal: number }>).reduce((acc, c) => acc + c.valor_mensal, 0);
  }
}
