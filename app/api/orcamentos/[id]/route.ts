import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrcamentoContext } from "@/lib/contexts/orcamento";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = createOrcamentoContext(createSupabaseServerClient());

  try {
    const data = await ctx.buscarPorId(params.id);
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Falha ao buscar orçamento", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const ctx = createOrcamentoContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    if (!body) throw new ValidationError("Corpo da requisição inválido.");

    const data = await ctx.atualizar(params.id, body);
    logger.info("Orçamento atualizado", { id: params.id });
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Falha ao atualizar orçamento", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createOrcamentoContext(createSupabaseServerClient());

  try {
    await ctx.remover(params.id);
    logger.info("Orçamento excluído", { id: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Falha ao excluir orçamento", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
