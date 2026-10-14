import { corpo, responder, sessao } from "@/lib/api";
import { createRhContext } from "@/lib/contexts/rh";

interface Params {
  params: { id: string };
}

/** GET: entregas de EPI do funcionário (migração 052). */
export async function GET(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("listar as entregas de EPI", () => createRhContext(supabase).listarEpis(params.id));
}

/** POST: registra uma entrega de EPI. */
export async function POST(request: Request, { params }: Params) {
  const { supabase, email } = await sessao();
  const dados = await corpo(request);
  return responder("registrar a entrega de EPI", () => createRhContext(supabase).registrarEpi(params.id, dados, email), 201);
}

/** PATCH ?epi=<id>: edita uma entrega (ex.: registrar a devolução). */
export async function PATCH(request: Request) {
  const { supabase } = await sessao();
  const id = new URL(request.url).searchParams.get("epi") ?? "";
  const dados = await corpo(request);
  return responder("editar a entrega de EPI", () => createRhContext(supabase).atualizarEpi(id, dados));
}

/** DELETE ?epi=<id>: apaga uma entrega lançada errado. */
export async function DELETE(request: Request) {
  const { supabase } = await sessao();
  const id = new URL(request.url).searchParams.get("epi") ?? "";
  return responder("excluir a entrega de EPI", async () => {
    await createRhContext(supabase).removerEpi(id);
    return { id };
  });
}
