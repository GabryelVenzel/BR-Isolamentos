import type { SupabaseClient } from "@supabase/supabase-js";
import type { FuncionarioAusencia, FuncionarioDados, FuncionarioEpi } from "../types/domain";
import { BaseRepository } from "./base";

// Tabelas da ficha do funcionário criadas na migração 052. Dados sensíveis,
// EPI e ausências ficam em tabelas próprias: as duas primeiras só o módulo RH
// lê; ausências qualquer usuário ativo lê (capacidade e alocação de obras).

export class FuncionarioDadosRepository extends BaseRepository<FuncionarioDados> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "funcionario_dados");
  }

  async buscar(funcionarioId: string): Promise<FuncionarioDados | null> {
    const { data, error } = await this.queryBuilder().select("*").eq("funcionario_id", funcionarioId).maybeSingle();
    if (error) throw error;
    return (data as FuncionarioDados) ?? null;
  }

  async salvar(funcionarioId: string, dados: Partial<FuncionarioDados>): Promise<FuncionarioDados> {
    const { data, error } = await this.queryBuilder()
      .upsert({ ...dados, funcionario_id: funcionarioId, updated_at: new Date().toISOString() }, { onConflict: "funcionario_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data as FuncionarioDados;
  }
}

export class FuncionarioEpiRepository extends BaseRepository<FuncionarioEpi> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "funcionario_epis");
  }

  async listarPorFuncionario(funcionarioId: string): Promise<FuncionarioEpi[]> {
    const { data, error } = await this.queryBuilder()
      .select("*")
      .eq("funcionario_id", funcionarioId)
      .order("data_entrega", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as FuncionarioEpi[];
  }
}

export class FuncionarioAusenciaRepository extends BaseRepository<FuncionarioAusencia> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "funcionario_ausencias");
  }

  async listarPorFuncionario(funcionarioId: string): Promise<FuncionarioAusencia[]> {
    const { data, error } = await this.queryBuilder().select("*").eq("funcionario_id", funcionarioId).order("inicio", { ascending: false });
    if (error) throw error;
    return (data ?? []) as FuncionarioAusencia[];
  }

  /** Ausências que terminam a partir de `desde` (YYYY-MM-DD) — as que ainda
   * importam para capacidade e alocação. Sem a tabela (migração 052 não
   * rodada), lista vazia. */
  async listarAPartirDe(desde: string): Promise<FuncionarioAusencia[]> {
    const { data, error } = await this.queryBuilder().select("*").gte("fim", desde).order("inicio");
    if (error) return [];
    return (data ?? []) as FuncionarioAusencia[];
  }
}
