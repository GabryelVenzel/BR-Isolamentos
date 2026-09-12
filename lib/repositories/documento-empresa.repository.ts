import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentoEmpresa } from "../types/domain";
import { BaseRepository } from "./base";

export class DocumentoEmpresaRepository extends BaseRepository<DocumentoEmpresa> {
  constructor(supabase: SupabaseClient) {
    super(supabase, "documentos_empresa");
  }

  async listar(): Promise<DocumentoEmpresa[]> {
    const { data, error } = await this.queryBuilder().select(this.select).order("nome");
    if (error) throw error;
    return (data ?? []) as unknown as DocumentoEmpresa[];
  }
}
