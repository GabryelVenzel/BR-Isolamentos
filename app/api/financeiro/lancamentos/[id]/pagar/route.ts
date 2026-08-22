import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: marca um lançamento como pago. Corpo opcional: `{ dataPagamento }`
 * (default: hoje). */
export async function POST(request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => ({}));

  try {
    const lancamento = await ctx.marcarComoPago(params.id, body?.dataPagamento);
    logger.info("Lançamento marcado como pago", { id: params.id });
    return NextResponse.json(apiSuccess(lancamento));
  } catch (error) {
    logger.error("Falha ao marcar lançamento como pago", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
