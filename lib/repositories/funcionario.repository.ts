import type { SupabaseClient } from "@supabase/supabase-js";
import type { Funcionario, StatusFuncionario } from "../types/domain";
import { BaseRepository } from "./base";

export interface FiltrosFuncionario {
  status?: StatusFuncionario;
  busca?: string;
}

export class FuncionarioRepository extends BaseRepository<Funcionario> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "funcionarios");
  }

  async listar(filtros: FiltrosFuncionario = {}): Promise<Funcionario[]> {
    let query = this.queryBuilder().select(this.select).order("nome");

    if (filtros.status) query = query.eq("status", filtros.status);
    if (filtros.busca) query = query.ilike("nome", `%${filtros.busca}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Funcionario[];
  }
}
