import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: cancela um agendamento de reativação (botão "Cancelar" — o lead
 * continua Frio, só deixa de ter retorno automático programado). Corpo
 * opcional: `{ motivoCancelamento?: string }`. */
export async function POST(request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const body = await request.json().catch(() => ({}));

  try {
    const agendamento = await ctx.cancelarAgendamentoFrio(params.id, body);
    logger.info("Agendamento de reativação cancelado", { agendamentoId: params.id });
    return NextResponse.json(apiSuccess(agendamento));
  } catch (error) {
    logger.error("Falha ao cancelar agendamento de reativação", error, { agendamentoId: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
