// Ajudantes das rotas de API no envelope padrão ({ success, data | error }).

import { NextResponse } from "next/server";
import { toHttpError } from "./errors";
import { logger } from "./logger";
import { createSupabaseServerClient } from "./supabase/server";
import { apiError, apiSuccess } from "./types/common";

/** Executa a ação da rota e devolve a resposta no envelope padrão, com o
 * tratamento de erro de sempre (`toHttpError` + log). `contexto` identifica
 * a operação no log ("criar pedido de compra"). */
export async function responder<T>(contexto: string, acao: () => Promise<T>, status = 200): Promise<NextResponse> {
  try {
    const data = await acao();
    return NextResponse.json(apiSuccess(data), { status });
  } catch (error) {
    logger.error(`Falha ao ${contexto}`, error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** Cliente da sessão + e-mail de quem está chamando (para "criado por"). */
export async function sessao() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, email: user?.email ?? null, appMetadata: user?.app_metadata ?? null };
}

export async function corpo(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
