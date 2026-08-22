import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { AtualizarConfigPrazoEtapasSchema, parseOrThrow } from "@/lib/validators";

/** GET: prazo máximo (dias) por etapa antes de um lead ser considerado
 * "atrasado" (aba Configurações) — não confundir com
 * /api/comercial/configuracoes/reativacao (prazo de retorno de lead frio). */
export async function GET() {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    const config = await ctx.obterConfigPrazoEtapas();
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    logger.error("Falha ao buscar configuração de prazo por etapa", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** PUT: atualiza os prazos máximos por etapa. */
export async function PUT(request: Request) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const dados = parseOrThrow(AtualizarConfigPrazoEtapasSchema, body);
    const config = await ctx.atualizarConfigPrazoEtapas(dados);
    logger.info("Configuração de prazo por etapa atualizada", dados);
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    logger.error("Falha ao atualizar configuração de prazo por etapa", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
