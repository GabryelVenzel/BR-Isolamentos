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

  /** Usado por `marcarComoPago` (lançamentos genéricos) pra saber se o
   * lançamento marcado como pago "por fora" (aba Lançamentos, não pelo botão
   * do card de Custo Fixo) pertence a um custo fixo — e, se sim, sincronizar
   * o histórico junto (ver comentário em lib/usecases/financeiro/marcarComoPago.ts). */
  async buscarPorLancamentoId(lancamentoId: string): Promise<HistoricoCustoFixo | null> {
    const { data, error } = await this.queryBuilder().select(this.select).eq("lancamento_id", lancamentoId).maybeSingle();

    if (error) throw error;
    return (data as unknown as HistoricoCustoFixo) ?? null;
  }
}
