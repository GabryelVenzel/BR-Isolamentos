import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfigPrazoEtapas } from "../types/domain";
import { BaseRepository } from "./base";

/** Linha única (id fixo = 1) — mesmo padrão de config_empresa /
 * ConfigReativacaoLeadsFriosRepository. Seedada em
 * sql-migration-006-prazo-etapas.sql com os prazos padrão (7/10/15/20 dias). */
export class ConfigPrazoEtapasRepository extends BaseRepository<ConfigPrazoEtapas> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "config_prazo_etapas");
  }

  async obter(): Promise<ConfigPrazoEtapas> {
    return this.findByIdOrThrow(1);
  }

  async atualizar(dados: Partial<ConfigPrazoEtapas>): Promise<ConfigPrazoEtapas> {
    return this.update(1, dados);
  }
}
