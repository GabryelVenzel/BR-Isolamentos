import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: vincula mais um orçamento ao lead (migração 053 — vários por lead);
 * ter ao menos um é pré-requisito pra mover o lead pra "negociação" (ver
 * lib/usecases/comercial/moverLead.ts). Corpo: `{ orcamentoId: number }`. */
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

/** DELETE ?orcamento=ID: remove o orçamento do lead — só até a etapa
 * Proposta (migração 053). */
export async function DELETE(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createComercialContext(supabase);
  const orcamentoId = Number(new URL(request.url).searchParams.get("orcamento"));

  try {
    if (!orcamentoId) throw new ValidationError("Informe o orçamento a remover.");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const lead = await ctx.desvincularOrcamento(params.id, orcamentoId, user?.email ?? null);
    logger.info("Orçamento removido do lead", { leadId: params.id, orcamentoId });
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    logger.error("Falha ao remover orçamento do lead", error, { leadId: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
