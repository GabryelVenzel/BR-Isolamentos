import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjecaoFinanceira } from "../types/domain";
import { BaseRepository } from "./base";

/** Projeções financeiras (migração 054). */
export class ProjecaoFinanceiraRepository extends BaseRepository<ProjecaoFinanceira> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "projecoes_financeiras");
  }

  /** As que ainda valem: vencimento hoje ou depois (as vencidas deixam de
   * contar sozinhas). `ate` limita o fim (opcional). */
  async listarVigentes(hoje: string, ate?: string): Promise<ProjecaoFinanceira[]> {
    let query = this.queryBuilder().select(this.select).gte("data", hoje).order("data");
    if (ate) query = query.lte("data", ate);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as ProjecaoFinanceira[];
  }
}
