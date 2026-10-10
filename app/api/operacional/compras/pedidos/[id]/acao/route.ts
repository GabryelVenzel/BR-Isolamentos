import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string };
}

/** POST { acao: "enviar" | "cancelar" | "reabrir" }: muda a situação do pedido. */
export async function POST(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const dados = await corpo(request);
  return responder("mudar a situação do pedido de compra", () => createComprasContext(supabase).acaoPedido(params.id, dados));
}
