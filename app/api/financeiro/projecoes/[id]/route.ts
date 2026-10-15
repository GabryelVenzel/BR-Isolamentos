import { corpo, responder, sessao } from "@/lib/api";
import { ProjecaoFinanceiraRepository } from "@/lib/repositories";
import { UpdateProjecaoSchema, parseOrThrow } from "@/lib/validators";

interface Params {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const dados = await corpo(request);
  return responder("atualizar a projeção", async () =>
    new ProjecaoFinanceiraRepository(supabase).update(params.id, { ...parseOrThrow(UpdateProjecaoSchema, dados), updated_at: new Date().toISOString() })
  );
}

export async function DELETE(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("apagar a projeção", async () => {
    await new ProjecaoFinanceiraRepository(supabase).delete(params.id);
    return { id: params.id };
  });
}
