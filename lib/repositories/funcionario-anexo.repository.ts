import type { SupabaseClient } from "@supabase/supabase-js";
import type { FuncionarioAnexo } from "../types/domain";
import { BaseRepository } from "./base";
import { documentosVigentes } from "../rh";

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

  /** Documentos com validade preenchida de funcionários ATIVOS — base dos
   * alertas de vencimento (lib/alertas.ts). Quem foi desligado não gera aviso. */
  async listarComValidade(): Promise<Array<{ nome: string; validade: string; funcionario: string }>> {
    // Todos os documentos (com e sem validade) de funcionários ativos: um
    // documento vencido só conta se não houver outro mais novo do mesmo tipo
    // para a mesma pessoa (migração 052 — ver documentosVigentes, lib/rh.ts).
    const { data, error } = await this.queryBuilder()
      .select("*, funcionario:funcionarios!inner(nome, status)")
      .eq("funcionario.status", "ativo");
    if (error) throw error;
    const linhas = (data ?? []) as Array<{ funcionario_id: string; tipo_id?: string | null; nome: string; validade: string | null; funcionario: { nome: string } }>;
    const porFuncionario = new Map<string, typeof linhas>();
    for (const l of linhas) porFuncionario.set(l.funcionario_id, [...(porFuncionario.get(l.funcionario_id) ?? []), l]);
    return [...porFuncionario.values()]
      .flatMap((docs) => documentosVigentes(docs))
      .filter((d): d is (typeof linhas)[number] & { validade: string } => !!d.validade)
      .map((d) => ({ nome: d.nome, validade: d.validade, funcionario: d.funcionario.nome }));
  }

  /** Todos os documentos (só id do funcionário, tipo e validade) — base do
   * selo de situação da lista de funcionários. */
  async listarResumo(): Promise<Array<{ funcionario_id: string; tipo_id: string | null; validade: string | null }>> {
    const { data, error } = await this.queryBuilder().select("*");
    if (error) throw error;
    return ((data ?? []) as Array<{ funcionario_id: string; tipo_id?: string | null; validade: string | null }>).map((d) => ({
      funcionario_id: d.funcionario_id,
      tipo_id: d.tipo_id ?? null,
      validade: d.validade,
    }));
  }
}
