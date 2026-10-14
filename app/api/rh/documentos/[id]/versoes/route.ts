import { responder, sessao } from "@/lib/api";
import { createRhContext } from "@/lib/contexts/rh";

interface Params {
  params: { id: string };
}

/** GET: todas as versões de um documento da empresa (migração 052). */
export async function GET(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("listar as versões do documento", () => createRhContext(supabase).listarVersoesDocumentoEmpresa(params.id));
}
