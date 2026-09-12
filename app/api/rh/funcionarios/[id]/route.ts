import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRhContext } from "@/lib/contexts/rh";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = createRhContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const funcionario = await ctx.atualizarFuncionario(params.id, body);
    logger.info("Funcionário atualizado", { id: params.id });
    return NextResponse.json(apiSuccess(funcionario));
  } catch (error) {
    logger.error("Falha ao atualizar funcionário", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createRhContext(createSupabaseServerClient());

  try {
    await ctx.removerFuncionario(params.id);
    logger.info("Funcionário excluído", { id: params.id });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    logger.error("Falha ao excluir funcionário", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
