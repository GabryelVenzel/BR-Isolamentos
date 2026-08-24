import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const categoria = await ctx.atualizarCategoria(params.id, body);
    logger.info("Categoria de lançamento atualizada", { id: params.id });
    return NextResponse.json(apiSuccess(categoria));
  } catch (error) {
    logger.error("Falha ao atualizar categoria de lançamento", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** DELETE: bloqueia categorias protegidas (pré-definidas) e categorias com
 * lançamentos vinculados (ver lib/usecases/financeiro/removerCategoria.ts). */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());

  try {
    await ctx.removerCategoria(params.id);
    logger.info("Categoria de lançamento excluída", { id: params.id });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    logger.error("Falha ao excluir categoria de lançamento", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
