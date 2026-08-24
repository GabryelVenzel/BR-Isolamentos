import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: vincula um orçamento ao lead — pré-requisito pra mover o lead pra
 * etapa "proposta" (ver lib/usecases/comercial/moverLead.ts). Ao vincular,
 * `valor_estimado` do lead passa a refletir o valor final do orçamento.
 * Corpo: `{ orcamentoId: number }`. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createComercialContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    if (!body?.orcamentoId) throw new ValidationError("Informe o orçamento a vincular.");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const lead = await ctx.vincularOrcamento(params.id, body.orcamentoId, user?.email ?? null);
    logger.info("Orçamento vinculado ao lead", { leadId: params.id, orcamentoId: body.orcamentoId });
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    logger.error("Falha ao vincular orçamento ao lead", error, { leadId: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
