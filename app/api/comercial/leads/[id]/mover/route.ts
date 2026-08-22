import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: move o lead para qualquer etapa do funil (qualquer transição é
 * permitida — ver `lib/usecases/comercial/moverLead.ts`). Corpo:
 * `{ novaEtapa: EtapaFunil }`. Usado tanto pelo drag&drop do Kanban quanto
 * pelo dropdown de etapa do LeadDetailModal. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createComercialContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    if (!body?.novaEtapa) throw new ValidationError("Informe a nova etapa.");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const lead = await ctx.moverLead(params.id, body.novaEtapa, user?.email ?? null);
    logger.info("Lead movido de etapa", { id: params.id, novaEtapa: body.novaEtapa });
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    logger.error("Falha ao mover lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
