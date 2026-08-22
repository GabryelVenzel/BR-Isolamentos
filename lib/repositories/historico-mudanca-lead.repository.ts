import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricoMudancaLead } from "../types/domain";
import { BaseRepository } from "./base";

export class HistoricoMudancaLeadRepository extends BaseRepository<HistoricoMudancaLead> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "historico_mudancas_leads");
  }

  /** Timeline completa de um lead (mais recente primeiro) — ver
   * TimelineHistorico.tsx. */
  async listarPorLead(leadId: string): Promise<HistoricoMudancaLead[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("lead_id", leadId)
      .order("data_mudanca", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as HistoricoMudancaLead[];
  }

  /** Todo o histórico de mudança de etapa de um conjunto de leads, numa
   * única query — usado pelo relatório (lib/usecases/comercial/relatorio.ts)
   * para reconstruir por quais etapas cada lead passou e quanto tempo ficou
   * em cada uma, sem 1 query por lead. */
  async listarPorLeads(leadIds: string[]): Promise<HistoricoMudancaLead[]> {
    if (leadIds.length === 0) return [];
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .in("lead_id", leadIds)
      .order("data_mudanca", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as HistoricoMudancaLead[];
  }
}
