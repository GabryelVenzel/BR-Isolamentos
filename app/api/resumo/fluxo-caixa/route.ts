import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumoContext } from "@/lib/contexts/resumo";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: fluxo de caixa (saldo de hoje, projeção de 90 dias, meses, semanas
 * e aging) — ver lib/usecases/resumo/fluxoCaixa.ts. */
export async function GET() {
  const ctx = createResumoContext(createSupabaseServerClient());

  try {
    return NextResponse.json(apiSuccess(await ctx.fluxoCaixa()));
  } catch (error) {
    logger.error("Falha ao montar o fluxo de caixa", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
