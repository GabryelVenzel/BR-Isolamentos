import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnexoLead } from "../types/domain";
import { BaseRepository } from "./base";

export class AnexoLeadRepository extends BaseRepository<AnexoLead> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "anexos_lead");
  }

  async listarPorLead(leadId: string): Promise<AnexoLead[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("lead_id", leadId)
      .order("data_adicao", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as AnexoLead[];
  }
}
