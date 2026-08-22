import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumoContext } from "@/lib/contexts/resumo";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const ctx = createResumoContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const dados = await ctx.chartReceitaVsDespesa({
      tipoTrabalho: searchParams.get("tipo") ?? undefined,
      responsavel: searchParams.get("responsavel") ?? undefined,
    });
    return NextResponse.json(apiSuccess(dados));
  } catch (error) {
    logger.error("Falha ao montar gráfico receita x despesa", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
