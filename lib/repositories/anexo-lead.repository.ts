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

  /** Quantos anexos um lead tem — usado por `moverLead.ts` pra validar o
   * comprovante obrigatório de um lead de comissão antes de avançar pra
   * "negociação" (migração 026), sem precisar carregar os anexos inteiros. */
  async contarPorLead(leadId: string): Promise<number> {
    const { count, error } = await this.queryBuilder()
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId);

    if (error) throw error;
    return count ?? 0;
  }

  /** Contagem de anexos por lead, em lote — alimenta o indicador visual do
   * card do Kanban (✅/⚠️ tem comprovante) sem 1 query por lead de comissão
   * (ver createComercialContext#listarLeads). */
  async contarPorLeads(leadIds: string[]): Promise<Record<string, number>> {
    if (leadIds.length === 0) return {};

    const { data, error } = await this.queryBuilder().select("lead_id").in("lead_id", leadIds);
    if (error) throw error;

    const contagem: Record<string, number> = {};
    for (const linha of (data ?? []) as Array<{ lead_id: string }>) {
      contagem[linha.lead_id] = (contagem[linha.lead_id] ?? 0) + 1;
    }
    return contagem;
  }
}
