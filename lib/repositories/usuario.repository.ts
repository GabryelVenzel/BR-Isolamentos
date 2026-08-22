import type { SupabaseClient } from "@supabase/supabase-js";
import type { Usuario } from "../types";
import { BaseRepository } from "./base";

/** "usuarios" é o roster de responsáveis do CRM (dropdown "Responsável" do
 * Kanban) — não é uma tabela de credenciais: login é 100% via Supabase Auth,
 * esta tabela é só o perfil complementar (nome/telefone/ativo). Criar uma
 * linha aqui via aba Configurações NÃO dá acesso de login a ninguém. */
export class UsuarioRepository extends BaseRepository<Usuario> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "usuarios");
  }

  async listarAtivos(): Promise<Usuario[]> {
    const { data, error } = await this.queryBuilder().select(this.select).eq("ativo", true).order("nome");
    if (error) throw error;
    return (data ?? []) as unknown as Usuario[];
  }

  /** Lista todos, ativos e inativos — usado pela aba Configurações (o
   * dropdown de responsável, em vez, usa `listarAtivos`). */
  async listarTodos(): Promise<Usuario[]> {
    const { data, error } = await this.queryBuilder().select(this.select).order("nome");
    if (error) throw error;
    return (data ?? []) as unknown as Usuario[];
  }
}
