import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfigFinanceiro } from "../types/domain";
import { BaseRepository } from "./base";

/** Linha única (id fixo = 1) — mesmo padrão de config_empresa. */
export class ConfigFinanceiroRepository extends BaseRepository<ConfigFinanceiro> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "config_financeiro");
  }

  async obter(): Promise<ConfigFinanceiro> {
    return this.findByIdOrThrow(1);
  }

  async atualizar(dados: Partial<ConfigFinanceiro>): Promise<ConfigFinanceiro> {
    return this.update(1, dados);
  }
}
