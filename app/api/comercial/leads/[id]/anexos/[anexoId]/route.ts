import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string; anexoId: string };
}

/** DELETE: desassocia o anexo do lead — o arquivo em si já foi removido do
 * Storage pelo chamador antes desta chamada (ver AnexosLead.tsx). */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    await ctx.removerAnexoLead(params.anexoId);
    logger.info("Anexo removido do lead", { leadId: params.id, anexoId: params.anexoId });
    return NextResponse.json(apiSuccess({ id: params.anexoId }));
  } catch (error) {
    logger.error("Falha ao remover anexo do lead", error, { id: params.id, anexoId: params.anexoId });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
