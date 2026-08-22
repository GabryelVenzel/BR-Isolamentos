import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumoContext } from "@/lib/contexts/resumo";
import { apiError, apiSuccess } from "@/lib/types/common";
import { parseFiltrosResumo } from "@/lib/types/api";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const ctx = createResumoContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const distribuicao = await ctx.chartDistribuicaoTipo(parseFiltrosResumo(searchParams));
    return NextResponse.json(apiSuccess(distribuicao));
  } catch (error) {
    logger.error("Falha ao montar distribuição de receita por tipo", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
