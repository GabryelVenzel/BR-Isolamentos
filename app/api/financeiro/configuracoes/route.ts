import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFinanceiroContext } from "@/lib/contexts/financeiro";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { AtualizarConfigFinanceiroSchema, parseOrThrow } from "@/lib/validators";

/** GET: configuração do ciclo financeiro (aba Configurações). */
export async function GET() {
  const ctx = createFinanceiroContext(createSupabaseServerClient());

  try {
    const config = await ctx.obterConfig();
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    logger.error("Falha ao buscar configuração financeira", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function PUT(request: Request) {
  const ctx = createFinanceiroContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const dados = parseOrThrow(AtualizarConfigFinanceiroSchema, body);
    const config = await ctx.atualizarConfig(dados);
    logger.info("Configuração financeira atualizada", dados);
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    logger.error("Falha ao atualizar configuração financeira", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
