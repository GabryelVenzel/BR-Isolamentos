import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfigReativacaoLeadsFrios } from "../types/domain";
import { BaseRepository } from "./base";

/** Linha única (id fixo = 1) — mesmo padrão de config_empresa. Seedada em
 * sql-migration-005-crm-avancado.sql com os prazos padrão (15/20/30/40
 * dias); `obter()` assume que essa linha sempre existe. */
export class ConfigReativacaoLeadsFriosRepository extends BaseRepository<ConfigReativacaoLeadsFrios> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "config_reativacao_leads_frios");
  }

  async obter(): Promise<ConfigReativacaoLeadsFrios> {
    return this.findByIdOrThrow(1);
  }

  async atualizar(dados: Partial<ConfigReativacaoLeadsFrios>): Promise<ConfigReativacaoLeadsFrios> {
    return this.update(1, dados);
  }
}
