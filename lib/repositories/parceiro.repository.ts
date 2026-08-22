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
}
