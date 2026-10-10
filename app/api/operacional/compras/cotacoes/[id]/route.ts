import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string };
}

/** PATCH: altera título, obra, observações e itens da cotação. */
export async function PATCH(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const dados = await corpo(request);
  return responder("atualizar cotação", () => createComprasContext(supabase).atualizarCotacao(params.id, dados));
}

/** DELETE: exclui a cotação e suas propostas. */
export async function DELETE(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("excluir cotação", async () => {
    await createComprasContext(supabase).excluirCotacao(params.id);
    return { id: params.id };
  });
}
