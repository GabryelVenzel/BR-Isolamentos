import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServicoParceiroExecucao } from "../types/domain";
import { BaseRepository } from "./base";

export class ServicoParceiroExecucaoRepository extends BaseRepository<ServicoParceiroExecucao> {
  // Nome do parceiro é sempre necessário onde isso é exibido (Detalhes do
  // serviço, cards do Kanban) — join direto, mesmo padrão de ServicoRepository.
  protected select = "*, parceiro:parceiros(*)";

  constructor(supabase: SupabaseClient) {
    super(supabase, "servico_parceiros_execucao");
  }

  async listarPorServico(servicoId: string): Promise<ServicoParceiroExecucao[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("servico_id", servicoId)
      .order("data_adicao", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as ServicoParceiroExecucao[];
  }
}
