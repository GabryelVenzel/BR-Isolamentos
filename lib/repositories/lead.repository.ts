import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtapaFunil, Lead } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosLead {
  etapa?: EtapaFunil | string;
  atribuidoA?: string;
}

export class LeadRepository extends BaseRepository<Lead> {
  // Cliente resolvido via join — todo lugar que lista/mostra um lead precisa
  // do nome do cliente junto (card do Kanban, detalhe, timeline).
  protected select = "*, cliente:clientes(*)";

  constructor(supabase: SupabaseClient) {
    super(supabase, "leads");
  }

  async listar(filtros: FiltrosLead = {}): Promise<Lead[]> {
    let query = this.queryBuilder().select(this.select).order("created_at", { ascending: false });

    if (filtros.etapa) query = query.eq("etapa", filtros.etapa);
    if (filtros.atribuidoA) query = query.eq("atribuido_a", filtros.atribuidoA);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Lead[];
  }
}
