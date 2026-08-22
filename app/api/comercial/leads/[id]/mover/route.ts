import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: move o lead para uma nova etapa do funil, respeitando as transições
 * permitidas (ver `TRANSICOES_FUNIL` em lib/usecases/comercial/moverLead.ts).
 * Corpo: `{ novaEtapa: EtapaFunil }`. */
export async function POST(request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    if (!body?.novaEtapa) throw new ValidationError("Informe a nova etapa.");

    const lead = await ctx.moverLead(params.id, body.novaEtapa);
    logger.info("Lead movido de etapa", { id: params.id, novaEtapa: body.novaEtapa });
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    logger.error("Falha ao mover lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
