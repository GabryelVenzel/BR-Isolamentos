import type { SupabaseClient } from "@supabase/supabase-js";
import type { Parceiro } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosParceiro {
  ativo?: boolean;
  cidade?: string;
  /** Migração 027 — filtra pelo que o parceiro FORNECE, não pela categoria
   * bruta: "mao_de_obra" traz quem pode mobilizar gente (prestador/ambos —
   * Agenda, seletor de Serviço); "comissao" traz quem pode receber uma
   * indicação (parceria/ambos — seletor de Lead de comissão). Expressa a
   * INTENÇÃO de cada tela, em vez de cada chamador reimplementar o "in"
   * sobre os 3 valores crus de `categoria_parceiro`. */
  capacidade?: "mao_de_obra" | "comissao";
}

export class ParceiroRepository extends BaseRepository<Parceiro> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "parceiros");
  }

  async listar(filtros: FiltrosParceiro = {}): Promise<Parceiro[]> {
    let query = this.queryBuilder().select(this.select).order("nome");

    if (filtros.ativo !== undefined) query = query.eq("ativo", filtros.ativo);
    if (filtros.cidade) query = query.eq("cidade", filtros.cidade);
    if (filtros.capacidade === "mao_de_obra") query = query.in("categoria_parceiro", ["prestador", "ambos"]);
    if (filtros.capacidade === "comissao") query = query.in("categoria_parceiro", ["parceria", "ambos"]);

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
