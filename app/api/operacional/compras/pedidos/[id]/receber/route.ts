import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string };
}

/** POST: recebe o pedido e gera a conta a pagar (fornecedor + obra). */
export async function POST(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const dados = await corpo(request);
  return responder("receber pedido de compra", () => createComprasContext(supabase).receberPedido(params.id, dados));
}
