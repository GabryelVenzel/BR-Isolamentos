import { corpo, responder, sessao } from "@/lib/api";
import { createLixeiraContext } from "@/lib/contexts/lixeira";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { ehTipoLixeira, type TipoLixeira } from "@/lib/lixeira";

// Lixeira (migrações 045 e 047) de serviços, leads, orçamentos, clientes e
// lançamentos — só administradores: a regra de rota (lib/acesso.ts) barra os
// demais antes de chegar aqui e, para a remoção definitiva, o banco também.

interface Params {
  params: { tipo: string };
}

function tipoDaRota(tipo: string): TipoLixeira {
  if (!ehTipoLixeira(tipo)) throw new NotFoundError("Lixeira não encontrada.");
  return tipo;
}

/** GET: o que está na lixeira deste tipo. */
export async function GET(_request: Request, { params }: Params) {
  const { supabase } = await sessao();
  return responder("listar a lixeira", async () => createLixeiraContext(supabase).listar(tipoDaRota(params.tipo)));
}

/** POST { id, acao: "restaurar" | "excluir" }: restaura o registro como
 * estava ou o remove definitivamente. */
export async function POST(request: Request, { params }: Params) {
  const { supabase, email } = await sessao();
  const dados = (await corpo(request)) as { id?: unknown; acao?: unknown } | null;
  return responder("alterar a lixeira", async () => {
    const tipo = tipoDaRota(params.tipo);
    const id = typeof dados?.id === "string" || typeof dados?.id === "number" ? String(dados.id) : "";
    if (!id) throw new ValidationError("Informe o registro.");

    const ctx = createLixeiraContext(supabase);
    if (dados?.acao === "restaurar") await ctx.restaurar(tipo, id);
    else if (dados?.acao === "excluir") await ctx.excluirDeVez(tipo, id);
    else throw new ValidationError("Ação inválida.");
    return { tipo, id, acao: dados.acao, por: email };
  });
}
