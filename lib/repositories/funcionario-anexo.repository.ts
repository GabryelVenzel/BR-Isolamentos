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

  /** Documentos com validade preenchida de funcionários ATIVOS — base dos
   * alertas de vencimento (lib/alertas.ts). Quem foi desligado não gera aviso. */
  async listarComValidade(): Promise<Array<{ nome: string; validade: string; funcionario: string }>> {
    const { data, error } = await this.queryBuilder()
      .select("nome, validade, funcionario:funcionarios!inner(nome, status)")
      .not("validade", "is", null)
      .eq("funcionario.status", "ativo");
    if (error) throw error;
    return ((data ?? []) as Array<{ nome: string; validade: string; funcionario: { nome: string } }>).map((d) => ({
      nome: d.nome,
      validade: d.validade,
      funcionario: d.funcionario.nome,
    }));
  }
}
