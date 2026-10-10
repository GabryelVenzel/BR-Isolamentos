import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string };
}

/** PATCH: altera um pedido (só rascunho ou enviado). */
export async function PATCH(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const dados = await corpo(request);
  return responder("atualizar pedido de compra", () => createComprasContext(supabase).atualizarPedido(params.id, dados));
}

/** DELETE: exclui um pedido (só rascunho ou cancelado). */
export async function DELETE(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("excluir pedido de compra", async () => {
    await createComprasContext(supabase).excluirPedido(params.id);
    return { id: params.id };
  });
}
