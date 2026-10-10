import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { corpo, responder } from "@/lib/api";
import { createComprasContext } from "@/lib/contexts/compras";

interface Params {
  params: { id: string; anexoId: string };
}

/** DELETE: desassocia o anexo do parceiro — o arquivo em si já foi removido
 * do Storage pelo chamador antes desta chamada (ver ParceiroAnexos.tsx). */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    await ctx.removerAnexoParceiro(params.anexoId);
    logger.info("Anexo removido do parceiro", { parceiroId: params.id, anexoId: params.anexoId });
    return NextResponse.json(apiSuccess({ id: params.anexoId }));
  } catch (error) {
    logger.error("Falha ao remover anexo do parceiro", error, { id: params.id, anexoId: params.anexoId });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** PATCH { validade }: define (ou limpa) a validade do documento do parceiro
 * (migração 044). */
export async function PATCH(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const dados = await corpo(request);
  return responder("definir a validade do documento do parceiro", async () => {
    await createComprasContext(supabase).definirValidadeDoAnexo(params.id, params.anexoId, dados);
    return { id: params.anexoId };
  });
}
