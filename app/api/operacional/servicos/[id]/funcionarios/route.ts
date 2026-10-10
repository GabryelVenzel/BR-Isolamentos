import { corpo, responder, sessao } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string };
}

/** POST { funcionario_id, tipos_trabalho }: aloca um funcionário da equipe
 * própria na obra (alocar de novo a mesma pessoa só atualiza as funções). */
export async function POST(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const dados = await corpo(request);
  return responder("alocar funcionário na obra", async () => {
    await createComprasContext(supabase).alocarFuncionario(params.id, dados);
    return { ok: true };
  }, 201);
}

/** DELETE ?execucao=<id>: tira o funcionário da obra. */
export async function DELETE(request: Request, { params }: Params) {
  const { supabase } = await sessao();
  const execucaoId = new URL(request.url).searchParams.get("execucao") ?? "";
  return responder("remover funcionário da obra", async () => {
    await createComprasContext(supabase).removerFuncionario(params.id, execucaoId);
    return { id: execucaoId };
  });
}
