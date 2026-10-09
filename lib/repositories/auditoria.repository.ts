import type { SupabaseClient } from "@supabase/supabase-js";
import type { PageResult } from "../types/common";

/** Uma linha do registro de alterações (tabela `auditoria`, migração 039) —
 * gravada por gatilho do banco a cada inclusão/alteração/exclusão nas
 * tabelas de negócio. Só administradores conseguem ler; ninguém escreve
 * direto (não há regra de insert/update/delete pra usuários). */
export interface RegistroAuditoria {
  id: number;
  data: string;
  usuario_email: string | null;
  acao: "inclusao" | "alteracao" | "exclusao";
  tabela: string;
  registro_id: string | null;
  /** Rótulo legível do registro (nome, número, descrição...) quando existe. */
  registro_rotulo: string | null;
  /** inclusão/exclusão: o registro inteiro. alteração: só os campos que
   * mudaram, como `{ campo: { de, para } }`. */
  detalhes: Record<string, unknown>;
}

export interface FiltrosAuditoria {
  tabela?: string;
  usuarioEmail?: string;
  acao?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export class AuditoriaRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(filtros: FiltrosAuditoria = {}): Promise<PageResult<RegistroAuditoria>> {
    const page = Math.max(1, filtros.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, filtros.pageSize ?? 50));
    const inicio = (page - 1) * pageSize;

    let query = this.supabase
      .from("auditoria")
      .select("*", { count: "exact" })
      .order("data", { ascending: false })
      .order("id", { ascending: false })
      .range(inicio, inicio + pageSize - 1);

    if (filtros.tabela) query = query.eq("tabela", filtros.tabela);
    if (filtros.usuarioEmail) query = query.eq("usuario_email", filtros.usuarioEmail);
    if (filtros.acao) query = query.eq("acao", filtros.acao);
    if (filtros.dataInicio) query = query.gte("data", `${filtros.dataInicio}T00:00:00-03:00`);
    if (filtros.dataFim) query = query.lte("data", `${filtros.dataFim}T23:59:59-03:00`);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data ?? []) as RegistroAuditoria[], total: count ?? 0, page, pageSize };
  }
}
