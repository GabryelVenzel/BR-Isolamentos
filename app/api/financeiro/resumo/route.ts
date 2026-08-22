import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: receita/despesa/lucro do mês corrente (view `v_financeiro_mes_atual`)
 * + total mensal de custos fixos ativos. */
export async function GET() {
  const ctx = createFinanceiroContext(createSupabaseServerClient());

  try {
    const resumo = await ctx.resumoMesAtual();
    return NextResponse.json(apiSuccess(resumo));
  } catch (error) {
    logger.error("Falha ao calcular resumo financeiro do mês", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
