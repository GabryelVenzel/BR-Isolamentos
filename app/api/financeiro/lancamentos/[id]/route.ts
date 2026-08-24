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

/** PATCH: edita um lançamento (categoria, descrição, valor, data, anexos,
 * vínculos com orçamento/serviço/lead...). Sem use case dedicado — update
 * parcial direto, mesma justificativa de PATCH custos-fixos. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const lancamento = await ctx.atualizarLancamento(params.id, body ?? {});
    logger.info("Lançamento financeiro atualizado", { id: params.id });
    return NextResponse.json(apiSuccess(lancamento));
  } catch (error) {
    logger.error("Falha ao atualizar lançamento financeiro", error, { id: params.id });
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
