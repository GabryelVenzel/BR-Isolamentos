import type { SupabaseClient } from "@supabase/supabase-js";
import type { InteracaoServico } from "../types/domain";
import { BaseRepository } from "./base";

export class InteracaoServicoRepository extends BaseRepository<InteracaoServico> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "interacoes_servico");
  }

  async listarPorServico(servicoId: string): Promise<InteracaoServico[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("servico_id", servicoId)
      .order("data_interacao", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as InteracaoServico[];
  }
}
