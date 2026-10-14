import { corpo, responder, sessao } from "@/lib/api";
import { createRhContext } from "@/lib/contexts/rh";

interface Params {
  params: { id: string };
}

/** GET: férias, atestados e afastamentos do funcionário (migração 052). */
export async function GET(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("listar as ausências", () => createRhContext(supabase).listarAusencias(params.id));
}

/** POST: registra uma ausência. */
export async function POST(request: Request, { params }: Params) {
  const { supabase, email } = await sessao();
  const dados = await corpo(request);
  return responder("registrar a ausência", () => createRhContext(supabase).registrarAusencia(params.id, dados, email), 201);
}

/** DELETE ?ausencia=<id>. */
export async function DELETE(request: Request) {
  const { supabase } = await sessao();
  const id = new URL(request.url).searchParams.get("ausencia") ?? "";
  return responder("excluir a ausência", async () => {
    await createRhContext(supabase).removerAusencia(id);
    return { id };
  });
}
