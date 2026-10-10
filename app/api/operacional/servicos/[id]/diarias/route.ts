import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string };
}

/** GET: diárias apontadas na obra + resumo por parceiro. */
export async function GET(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("listar diárias da obra", () => createComprasContext(supabase).diariasDoServico(params.id));
}

/** POST: aponta uma diária na obra. */
export async function POST(request: Request, { params }: Params) {
  const { supabase, email } = await sessao();
  const dados = await corpo(request);
  return responder("apontar diária", () => createComprasContext(supabase).criarDiaria(params.id, dados, email), 201);
}

/** DELETE ?diaria=<id>: remove um apontamento. */
export async function DELETE(request: Request) {
  const { supabase } = await sessao();
  const diariaId = new URL(request.url).searchParams.get("diaria") ?? "";
  return responder("excluir diária", async () => {
    await createComprasContext(supabase).excluirDiaria(diariaId);
    return { id: diariaId };
  });
}
