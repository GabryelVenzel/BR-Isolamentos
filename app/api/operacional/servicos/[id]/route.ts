import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    const servico = await ctx.buscarServico(params.id);
    return NextResponse.json(apiSuccess(servico));
  } catch (error) {
    logger.error("Falha ao buscar serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** PATCH: atualiza campos de cadastro (não move etapa — ver rota /mover —
 * nem finaliza — ver rota /finalizar). */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const servico = await ctx.atualizarServico(params.id, body);
    logger.info("Serviço atualizado", { id: params.id });
    return NextResponse.json(apiSuccess(servico));
  } catch (error) {
    logger.error("Falha ao atualizar serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    await ctx.removerServico(params.id);
    logger.info("Serviço excluído", { id: params.id });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    logger.error("Falha ao excluir serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
