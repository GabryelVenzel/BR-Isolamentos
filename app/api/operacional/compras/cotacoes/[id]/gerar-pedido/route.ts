import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string };
}

/** POST { proposta_id }: transforma a proposta escolhida em pedido de compra. */
export async function POST(request: Request, { params }: Params) {
  const { supabase, email } = await sessao();
  const dados = await corpo(request);
  return responder("gerar pedido a partir da cotação", () => createComprasContext(supabase).gerarPedidoDaCotacao(params.id, dados, email), 201);
}
