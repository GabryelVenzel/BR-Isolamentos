import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadOrcamento } from "../types/domain";
import { BaseRepository } from "./base";

/** Vínculos lead ↔ orçamento (migração 053 — vários orçamentos por lead). */
export class LeadOrcamentoRepository extends BaseRepository<LeadOrcamento> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "lead_orcamentos");
  }

  async vincular(leadId: string, orcamentoId: number): Promise<void> {
    const { error } = await this.queryBuilder().upsert({ lead_id: leadId, orcamento_id: orcamentoId }, { onConflict: "lead_id,orcamento_id", ignoreDuplicates: true });
    if (error) throw error;
  }

  async desvincular(leadId: string, orcamentoId: number): Promise<void> {
    const { error } = await this.queryBuilder().delete().eq("lead_id", leadId).eq("orcamento_id", orcamentoId);
    if (error) throw error;
  }

  /** Marca quais orçamentos do lead foram os fechados (os demais ficam `false`). */
  async definirVencedores(leadId: string, orcamentoIds: number[]): Promise<void> {
    const { error } = await this.queryBuilder().update({ vencedor: false }).eq("lead_id", leadId);
    if (error) throw error;
    if (orcamentoIds.length === 0) return;
    const { error: erro2 } = await this.queryBuilder().update({ vencedor: true }).eq("lead_id", leadId).in("orcamento_id", orcamentoIds);
    if (erro2) throw erro2;
  }
}
