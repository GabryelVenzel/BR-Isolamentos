import type { SupabaseClient } from "@supabase/supabase-js";
import type { HistoricoCustoFixo } from "../types/domain";
import { BaseRepository } from "./base";

export class HistoricoCustoFixoRepository extends BaseRepository<HistoricoCustoFixo> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "historico_custos_fixos");
  }

  async listarPorCustoFixo(custoFixoId: string): Promise<HistoricoCustoFixo[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("custo_fixo_id", custoFixoId)
      .order("data_prevista", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as HistoricoCustoFixo[];
  }

  async buscarPorMes(custoFixoId: string, dataPrevista: string): Promise<HistoricoCustoFixo | null> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("custo_fixo_id", custoFixoId)
      .eq("data_prevista", dataPrevista)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as HistoricoCustoFixo) ?? null;
  }
}
