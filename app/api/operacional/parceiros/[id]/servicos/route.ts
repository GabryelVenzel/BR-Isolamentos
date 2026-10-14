import { responder, sessao } from "@/lib/api";
import { createOperacionalContext } from "@/lib/contexts/operacional";

interface Params {
  params: { id: string };
}

/** GET: obras em que o parceiro atuou (ficha do parceiro — revisão de usabilidade). */
export async function GET(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("listar as obras do parceiro", () => createOperacionalContext(supabase).listarServicosPorParceiro(params.id));
}
