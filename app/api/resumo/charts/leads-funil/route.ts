import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createResumoContext } from "@/lib/contexts/resumo";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  const ctx = createResumoContext(createSupabaseServerClient());

  try {
    const funil = await ctx.chartFunilLeads();
    return NextResponse.json(apiSuccess(funil));
  } catch (error) {
    logger.error("Falha ao montar funil de leads", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
