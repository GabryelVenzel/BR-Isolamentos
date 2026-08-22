import type { SupabaseClient } from "@supabase/supabase-js";
import type { InteracaoLead } from "../types/domain";
import { BaseRepository } from "./base";

export class InteracaoLeadRepository extends BaseRepository<InteracaoLead> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "interacoes_lead");
  }

  async listarPorLead(leadId: string): Promise<InteracaoLead[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("lead_id", leadId)
      .order("data_interacao", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as InteracaoLead[];
  }
}
