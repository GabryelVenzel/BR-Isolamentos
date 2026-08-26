import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: lista os parceiros vinculados ao serviço (ver ServicoDetailModal.tsx
 * → aba Parceiros). Normalmente já vem embutido no GET do serviço (join
 * `parceiros_execucao`), esta rota existe pra recarregar só essa lista sem
 * refazer a busca do serviço inteiro depois de adicionar/remover. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    const parceiros = await ctx.listarParceirosServico(params.id);
    return NextResponse.json(apiSuccess(parceiros));
  } catch (error) {
    logger.error("Falha ao listar parceiros do serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: vincula um parceiro ao serviço com headcount/tipos de trabalho
 * próprios — substitui o antigo "parceiro principal" único (ver
 * sql-migration-013). */
export async function POST(request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const execucao = await ctx.adicionarParceiroServico({ ...body, servico_id: params.id });
    logger.info("Parceiro adicionado ao serviço", { servicoId: params.id, parceiroId: body?.parceiro_id });
    return NextResponse.json(apiSuccess(execucao), { status: 201 });
  } catch (error) {
    logger.error("Falha ao adicionar parceiro ao serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
