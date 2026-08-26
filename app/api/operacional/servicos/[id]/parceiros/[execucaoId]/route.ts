import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string; execucaoId: string };
}

/** DELETE: desvincula um parceiro do serviço. */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    await ctx.removerParceiroServico(params.execucaoId);
    logger.info("Parceiro removido do serviço", { servicoId: params.id, execucaoId: params.execucaoId });
    return NextResponse.json(apiSuccess({ id: params.execucaoId }));
  } catch (error) {
    logger.error("Falha ao remover parceiro do serviço", error, { id: params.id, execucaoId: params.execucaoId });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
