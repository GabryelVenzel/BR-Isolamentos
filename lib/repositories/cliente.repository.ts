import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente } from "../types";
import type { ClienteResumo } from "../types/domain";
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

  /** Lista da aba "Clientes" do CRM — lê a view `v_clientes_resumo`
   * (cliente + contagem de leads + última interação já agregadas, ver
   * sql-migration-005-crm-avancado.sql), opcionalmente filtrada por nome. */
  async listarComResumo(busca?: string): Promise<ClienteResumo[]> {
    let query = this.supabase.from("v_clientes_resumo").select("*").order("nome");
    if (busca) query = query.ilike("nome", `%${busca}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ClienteResumo[];
  }

  /** Quantos leads existem para este cliente — usado para bloquear exclusão
   * (regra do pedido: "não deleta se houver leads associados"). */
  async contarLeads(clienteId: number): Promise<number> {
    const { count, error } = await this.supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId);

    if (error) throw error;
    return count ?? 0;
  }
}
