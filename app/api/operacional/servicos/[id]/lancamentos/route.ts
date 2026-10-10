import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroObraContext } from "@/lib/contexts/financeiro-obra";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: financeiro da obra — resultado (orçado, receita, despesa, margem),
 * os lançamentos ligados a ela e as categorias de despesa disponíveis. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createFinanceiroObraContext(createSupabaseServerClient());
  try {
    return NextResponse.json(apiSuccess(await ctx.financeiroDoServico(params.id)));
  } catch (error) {
    logger.error("Falha ao carregar o financeiro do serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: registra uma despesa já ligada a esta obra — é o caminho de quem
 * tem o módulo Operacional mas não o Financeiro. */
export async function POST(request: Request, { params }: Params) {
  const ctx = createFinanceiroObraContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);
  try {
    const lancamento = await ctx.registrarDespesaDoServico(params.id, body);
    logger.info("Despesa registrada pela obra", { servicoId: params.id, id: lancamento.id });
    return NextResponse.json(apiSuccess(lancamento), { status: 201 });
  } catch (error) {
    logger.error("Falha ao registrar despesa da obra", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
