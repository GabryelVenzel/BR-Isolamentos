import type { SupabaseClient } from "@supabase/supabase-js";
import type { Parceiro } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosParceiro {
  ativo?: boolean;
  cidade?: string;
}

export class ParceiroRepository extends BaseRepository<Parceiro> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "parceiros");
  }

  async listar(filtros: FiltrosParceiro = {}): Promise<Parceiro[]> {
    let query = this.queryBuilder().select(this.select).order("nome");

    if (filtros.ativo !== undefined) query = query.eq("ativo", filtros.ativo);
    if (filtros.cidade) query = query.eq("cidade", filtros.cidade);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Parceiro[];
  }

  /** Lê a view `v_capacidade_parceiros` (utilização semanal por parceiro,
   * cruzando `disponibilidade_horas_semana` com agendamentos ativos — ver
   * sql-migration-004-6modulos-completo.sql). Usada pelo alerta de
   * "parceiro no limite" e pelo gráfico Top Parceiros do dashboard. */
  async capacidadeView(): Promise<
    Array<{
      id: string;
      nome: string;
      disponibilidade_horas_semana: number | null;
      agendamentos_ativas: number;
      horas_alocadas: number;
      horas_disponiveis: number;
      percentual_utilizacao: number;
    }>
  > {
    const { data, error } = await this.supabase.from("v_capacidade_parceiros").select("*");
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      nome: string;
      disponibilidade_horas_semana: number | null;
      agendamentos_ativas: number;
      horas_alocadas: number;
      horas_disponiveis: number;
      percentual_utilizacao: number;
    }>;
  }
}
