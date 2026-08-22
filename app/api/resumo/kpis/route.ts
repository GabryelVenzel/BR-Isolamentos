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
    const kpis = await ctx.kpis(parseFiltrosResumo(searchParams));
    return NextResponse.json(apiSuccess(kpis));
  } catch (error) {
    logger.error("Falha ao calcular KPIs do dashboard", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
