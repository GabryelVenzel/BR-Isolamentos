import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: detalhe de um lead. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    const lead = await ctx.buscarLead(params.id);
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    logger.error("Falha ao buscar lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** PATCH: atualiza campos de cadastro (não move etapa — ver rota /mover). */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const lead = await ctx.atualizarLead(params.id, body);
    logger.info("Lead atualizado", { id: params.id });
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    logger.error("Falha ao atualizar lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    await ctx.removerLead(params.id);
    logger.info("Lead excluído", { id: params.id });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    logger.error("Falha ao excluir lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
