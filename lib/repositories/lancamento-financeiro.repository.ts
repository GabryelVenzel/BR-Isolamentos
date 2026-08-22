import type { SupabaseClient } from "@supabase/supabase-js";
import type { LancamentoFinanceiro, TipoLancamentoFinanceiro } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosLancamento {
  tipo?: TipoLancamentoFinanceiro | string;
  categoria?: string;
  pago?: boolean;
  dataInicio?: string;
  dataFim?: string;
}

export interface ResumoMesAtual {
  mes: string;
  receita_total: number;
  despesa_total: number;
  lucro_bruto: number;
  numero_orcamentos: number;
}

export class LancamentoFinanceiroRepository extends BaseRepository<LancamentoFinanceiro> {
  protected select = "*, orcamento:orcamentos(*, cliente:clientes(*))";

  constructor(supabase: SupabaseClient) {
    super(supabase, "lancamentos_financeiros");
  }

  async listar(filtros: FiltrosLancamento = {}): Promise<LancamentoFinanceiro[]> {
    let query = this.queryBuilder().select(this.select).order("data", { ascending: false });

    if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
    if (filtros.categoria) query = query.eq("categoria", filtros.categoria);
    if (filtros.pago !== undefined) query = query.eq("pago", filtros.pago);
    if (filtros.dataInicio) query = query.gte("data", filtros.dataInicio);
    if (filtros.dataFim) query = query.lte("data", filtros.dataFim);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as LancamentoFinanceiro[];
  }

  /** Lê a view `v_financeiro_mes_atual` (ver sql-migration-004-6modulos-completo.sql). */
  async resumoMesAtual(): Promise<ResumoMesAtual> {
    const { data, error } = await this.supabase.from("v_financeiro_mes_atual").select("*").maybeSingle();
    if (error) throw error;
    return (
      (data as unknown as ResumoMesAtual) ?? {
        mes: new Date().toISOString().slice(0, 7),
        receita_total: 0,
        despesa_total: 0,
        lucro_bruto: 0,
        numero_orcamentos: 0,
      }
    );
  }
}
