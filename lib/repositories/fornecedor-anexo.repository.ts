import type { SupabaseClient } from "@supabase/supabase-js";
import type { FornecedorAnexo } from "../types/domain";
import { BaseRepository } from "./base";

export class FornecedorAnexoRepository extends BaseRepository<FornecedorAnexo> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "fornecedor_anexos");
  }

  async listarPorFornecedor(fornecedorId: string): Promise<FornecedorAnexo[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("fornecedor_id", fornecedorId)
      .order("data_adicao", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as FornecedorAnexo[];
  }
}
