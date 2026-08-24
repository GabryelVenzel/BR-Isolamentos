import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricoServico } from "../types/domain";
import { BaseRepository } from "./base";

export class HistoricoServicoRepository extends BaseRepository<HistoricoServico> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "historico_servicos");
  }

  async listarPorServico(servicoId: string): Promise<HistoricoServico[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("servico_id", servicoId)
      .order("data_evento", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as HistoricoServico[];
  }
}
