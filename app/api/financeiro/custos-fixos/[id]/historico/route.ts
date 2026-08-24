import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());

  try {
    const historico = await ctx.listarHistoricoCustoFixo(params.id);
    return NextResponse.json(apiSuccess(historico));
  } catch (error) {
    logger.error("Falha ao listar histórico do custo fixo", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
