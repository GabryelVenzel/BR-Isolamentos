import type { SupabaseClient } from "@supabase/supabase-js";
import type { Fornecedor } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosFornecedor {
  ativo?: boolean;
  busca?: string;
}

export class FornecedorRepository extends BaseRepository<Fornecedor> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "fornecedores");
  }

  async listar(filtros: FiltrosFornecedor = {}): Promise<Fornecedor[]> {
    let query = this.queryBuilder().select(this.select).order("nome");

    if (filtros.ativo !== undefined) query = query.eq("ativo", filtros.ativo);
    if (filtros.busca) query = query.ilike("nome", `%${filtros.busca}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Fornecedor[];
  }
}
