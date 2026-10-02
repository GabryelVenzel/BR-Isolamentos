import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumoContext } from "@/lib/contexts/resumo";
import { apiError, apiSuccess } from "@/lib/types/common";
import { parseFiltrosResumo } from "@/lib/types/api";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Custos Fixos x Variáveis — movido da aba Financeira pra aba Geral do
 * Resumo (pedido explícito). Filtrado pelo período da FilterBar, igual aos
 * outros gráficos de `/api/resumo/charts/*`. */
export async function GET(request: Request) {
  const ctx = createResumoContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const dados = await ctx.chartCustosFixosVsVariaveis(parseFiltrosResumo(searchParams));
    return NextResponse.json(apiSuccess(dados));
  } catch (error) {
    logger.error("Falha ao montar custos fixos x variáveis", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
