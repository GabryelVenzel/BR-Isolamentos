import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumoContext } from "@/lib/contexts/resumo";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  const ctx = createResumoContext(createSupabaseServerClient());

  try {
    const parceiros = await ctx.chartTopParceiros();
    return NextResponse.json(apiSuccess(parceiros));
  } catch (error) {
    logger.error("Falha ao montar ranking de parceiros", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
