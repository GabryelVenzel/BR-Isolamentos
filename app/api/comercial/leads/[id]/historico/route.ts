import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: timeline de mudanças de etapa/temperatura do lead ("Caminho do
 * lead") — não confundir com /interacoes (timeline de contatos). */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    const historico = await ctx.listarHistorico(params.id);
    return NextResponse.json(apiSuccess(historico));
  } catch (error) {
    logger.error("Falha ao listar histórico do lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
