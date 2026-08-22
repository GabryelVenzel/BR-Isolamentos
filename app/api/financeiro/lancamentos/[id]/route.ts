import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());

  try {
    const lancamento = await ctx.buscarLancamento(params.id);
    return NextResponse.json(apiSuccess(lancamento));
  } catch (error) {
    logger.error("Falha ao buscar lançamento financeiro", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());

  try {
    await ctx.removerLancamento(params.id);
    logger.info("Lançamento financeiro excluído", { id: params.id });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    logger.error("Falha ao excluir lançamento financeiro", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
