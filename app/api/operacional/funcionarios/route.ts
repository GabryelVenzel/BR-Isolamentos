import { responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

/** GET: funcionários ativos (nome, cargo, funções) e os documentos vencidos
 * deles — para alocar numa obra ou apontar diária. Fica em /operacional
 * porque /api/rh é fechado a quem não tem o módulo RH. */
export async function GET() {
  const { supabase } = await sessao();
  return responder("listar funcionários para a obra", () => createComprasContext(supabase).funcionariosParaObra());
}
