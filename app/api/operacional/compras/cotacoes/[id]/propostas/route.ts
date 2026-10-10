import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string };
}

/** PUT: cria ou atualiza a proposta de um fornecedor nesta cotação. */
export async function PUT(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const dados = await corpo(request);
  return responder("salvar proposta da cotação", () => createComprasContext(supabase).salvarProposta(params.id, dados));
}

/** DELETE ?proposta=<id>: remove a proposta de um fornecedor. */
export async function DELETE(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const propostaId = new URL(request.url).searchParams.get("proposta") ?? "";
  return responder("remover proposta da cotação", () => createComprasContext(supabase).removerProposta(params.id, propostaId));
}
