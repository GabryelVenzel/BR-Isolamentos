import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string; anexoId: string };
}

/** DELETE: desassocia o anexo do fornecedor — o arquivo em si já foi
 * removido do Storage pelo chamador antes desta chamada (ver
 * FornecedorAnexos.tsx). */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    await ctx.removerAnexoFornecedor(params.anexoId);
    logger.info("Anexo removido do fornecedor", { fornecedorId: params.id, anexoId: params.anexoId });
    return NextResponse.json(apiSuccess({ id: params.anexoId }));
  } catch (error) {
    logger.error("Falha ao remover anexo do fornecedor", error, { id: params.id, anexoId: params.anexoId });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
