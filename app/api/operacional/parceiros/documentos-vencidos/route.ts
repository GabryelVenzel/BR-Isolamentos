import { responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

/** GET: documentos vencidos de parceiros ativos — usado pra avisar ao
 * alocar um parceiro numa obra ou apontar diária. */
export async function GET() {
  const { supabase } = await sessao();
  return responder("listar documentos vencidos de parceiros", () => createComprasContext(supabase).documentosVencidosDeParceiros());
}
