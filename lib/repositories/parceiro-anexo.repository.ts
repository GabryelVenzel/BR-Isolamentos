import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParceiroAnexo } from "../types/domain";
import { BaseRepository } from "./base";

export class ParceiroAnexoRepository extends BaseRepository<ParceiroAnexo> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "parceiro_anexos");
  }

  async listarPorParceiro(parceiroId: string): Promise<ParceiroAnexo[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .eq("parceiro_id", parceiroId)
      .order("data_adicao", { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as ParceiroAnexo[];
  }
}
