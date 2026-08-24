import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: marca o custo fixo como pago este mês — cria o lançamento de
 * despesa correspondente e atualiza o histórico (ver
 * lib/usecases/financeiro/marcarCustoFixoPago.ts). Corpo opcional:
 * `{ dataPagamento? }` (default: hoje). */
export async function POST(request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => ({}));

  try {
    const resultado = await ctx.marcarCustoFixoPago(params.id, body);
    logger.info("Custo fixo marcado como pago", { id: params.id, lancamentoId: resultado.lancamento.id });
    return NextResponse.json(apiSuccess(resultado));
  } catch (error) {
    logger.error("Falha ao marcar custo fixo como pago", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
