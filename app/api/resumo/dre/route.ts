import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroObraContext } from "@/lib/contexts/financeiro-obra";
import { apiError, apiSuccess } from "@/lib/types/common";
import { parseFiltrosResumo } from "@/lib/types/api";
import { resolverPeriodo } from "@/lib/usecases/resumo";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: DRE simplificado por mês de competência, no período do filtro do
 * Resumo (mesmos parâmetros das outras rotas de /api/resumo). */
export async function GET(request: Request) {
  const ctx = createFinanceiroObraContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);
  try {
    const filtros = parseFiltrosResumo(searchParams);
    const intervalo = resolverPeriodo(filtros.periodo, filtros.dataInicioCustom, filtros.dataFimCustom);
    return NextResponse.json(apiSuccess(await ctx.dre(intervalo.dataInicio, intervalo.dataFim)));
  } catch (error) {
    logger.error("Falha ao calcular DRE", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
