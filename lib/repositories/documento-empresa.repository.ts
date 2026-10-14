import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentoEmpresa } from "../types/domain";
import { BaseRepository } from "./base";

export class DocumentoEmpresaRepository extends BaseRepository<DocumentoEmpresa> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "documentos_empresa");
  }

  /** Versões ATUAIS (as anteriores de um documento renovado ficam de fora
   * — ver `listarVersoes`), cada uma com quantas versões anteriores tem. */
  async listar(): Promise<DocumentoEmpresa[]> {
    const { data, error } = await this.queryBuilder().select(this.select).order("nome");
    if (error) throw error;
    const todos = (data ?? []) as unknown as DocumentoEmpresa[];
    const atuais = todos.filter((d) => !d.arquivado_em);
    return atuais.map((d) => ({ ...d, versoes_anteriores: d.grupo_id ? todos.filter((o) => o.grupo_id === d.grupo_id && o.arquivado_em).length : 0 }));
  }

  /** Todas as versões de um documento, da mais nova para a mais antiga. */
  async listarVersoes(grupoId: string): Promise<DocumentoEmpresa[]> {
    const { data, error } = await this.queryBuilder().select(this.select).eq("grupo_id", grupoId).order("data_adicao", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as DocumentoEmpresa[];
  }
}
