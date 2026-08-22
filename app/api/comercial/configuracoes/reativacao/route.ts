import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { AtualizarConfigReativacaoSchema, parseOrThrow } from "@/lib/validators";

/** GET: prazos de reativação por etapa (aba Configurações). */
export async function GET() {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    const config = await ctx.obterConfigReativacao();
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    logger.error("Falha ao buscar configuração de reativação", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** PUT: atualiza os prazos de reativação (dias por etapa em que o lead
 * esfriou). Só afeta agendamentos criados DEPOIS da mudança — os já
 * agendados mantêm a data de retorno original. */
export async function PUT(request: Request) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const dados = parseOrThrow(AtualizarConfigReativacaoSchema, body);
    const config = await ctx.atualizarConfigReativacao(dados);
    logger.info("Configuração de reativação atualizada", dados);
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    logger.error("Falha ao atualizar configuração de reativação", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
