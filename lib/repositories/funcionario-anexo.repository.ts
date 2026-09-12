import type { SupabaseClient } from "@supabase/supabase-js";
import type { FuncionarioAnexo } from "../types/domain";
import { BaseRepository } from "./base";

export class FuncionarioAnexoRepository extends BaseRepository<FuncionarioAnexo> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "funcionario_anexos");
  }

  async listarPorFuncionario(funcionarioId: string): Promise<FuncionarioAnexo[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("funcionario_id", funcionarioId)
      .order("data_adicao", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as FuncionarioAnexo[];
  }
}
