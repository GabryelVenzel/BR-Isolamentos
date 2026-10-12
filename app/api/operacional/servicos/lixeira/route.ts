import { acessoDeMetadata } from "@/lib/acesso";
import { corpo, responder, sessao } from "@/lib/api";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { ForbiddenError, ValidationError } from "@/lib/errors";

// Lixeira de serviços (migração 045) — só administradores, conferido aqui
// (a regra de rota só exige o módulo Operacional) e, para a remoção
// definitiva, também pelo banco.

function exigirAdmin(appMetadata: Record<string, unknown> | null) {
  if (!acessoDeMetadata(appMetadata).admin) throw new ForbiddenError("Só administradores acessam a lixeira de serviços.");
}

/** GET: serviços na lixeira. */
export async function GET() {
  const { supabase, appMetadata } = await sessao();
  return responder("listar a lixeira de serviços", async () => {
    exigirAdmin(appMetadata);
    return createOperacionalContext(supabase).listarLixeiraServicos();
  });
}

/** POST { id, acao: "restaurar" | "excluir" }: restaura o serviço como
 * estava ou o remove definitivamente. */
export async function POST(request: Request) {
  const { supabase, appMetadata } = await sessao();
  const dados = (await corpo(request)) as { id?: unknown; acao?: unknown } | null;
  return responder("alterar a lixeira de serviços", async () => {
    exigirAdmin(appMetadata);
    if (typeof dados?.id !== "string" || !dados.id) throw new ValidationError("Informe o serviço.");
    const ctx = createOperacionalContext(supabase);
    if (dados.acao === "restaurar") await ctx.restaurarServico(dados.id);
    else if (dados.acao === "excluir") await ctx.excluirServicoDefinitivamente(dados.id);
    else throw new ValidationError("Ação inválida.");
    return { id: dados.id, acao: dados.acao };
  });
}
