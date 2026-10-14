import { responder, sessao } from "@/lib/api";
import { createRhContext } from "@/lib/contexts/rh";

interface Params {
  params: { id: string };
}

/** GET: pagamentos (lançamentos ligados ao funcionário), diárias de obra e
 * obras em que foi alocado (migração 052). */
export async function GET(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("carregar o histórico do funcionário", () => createRhContext(supabase).historicoFuncionario(params.id));
}
