import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const fornecedor = await ctx.atualizarFornecedor(params.id, body);
    logger.info("Fornecedor atualizado", { id: params.id });
    return NextResponse.json(apiSuccess(fornecedor));
  } catch (error) {
    logger.error("Falha ao atualizar fornecedor", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    await ctx.removerFornecedor(params.id);
    logger.info("Fornecedor excluído", { id: params.id });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    logger.error("Falha ao excluir fornecedor", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
