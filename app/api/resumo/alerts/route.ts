import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumoContext } from "@/lib/contexts/resumo";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  const ctx = createResumoContext(createSupabaseServerClient());

  try {
    const alertas = await ctx.alertas();
    return NextResponse.json(apiSuccess(alertas));
  } catch (error) {
    logger.error("Falha ao calcular alertas do dashboard", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
