import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente } from "../types";
import { BaseRepository } from "./base";

export class ClienteRepository extends BaseRepository<Cliente> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "clientes");
  }

  /** Busca por nome (case-insensitive, parcial) — usado no autocomplete do step-1
   * do wizard de orçamento. */
  async buscarPorNome(termo: string): Promise<Cliente[]> {
    const { data, error } = await this.queryBuilder()
      .select(this.select)
      .ilike("nome", `%${termo}%`)
      .order("nome");

    if (error) throw error;
    return (data ?? []) as unknown as Cliente[];
  }
}
