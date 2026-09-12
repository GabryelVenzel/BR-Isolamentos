import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRhContext } from "@/lib/contexts/rh";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string; anexoId: string };
}

/** PATCH: renomeia o documento do funcionário — o arquivo em si não muda por
 * aqui, só o nome. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = createRhContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const anexo = await ctx.renomearAnexoFuncionario(params.anexoId, body);
    logger.info("Anexo do funcionário renomeado", { funcionarioId: params.id, anexoId: params.anexoId });
    return NextResponse.json(apiSuccess(anexo));
  } catch (error) {
    logger.error("Falha ao renomear anexo do funcionário", error, { id: params.id, anexoId: params.anexoId });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** DELETE: desassocia o anexo do funcionário — o arquivo em si já foi
 * removido do Storage pelo chamador antes desta chamada (ver
 * FuncionarioAnexos.tsx). */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createRhContext(createSupabaseServerClient());

  try {
    await ctx.removerAnexoFuncionario(params.anexoId);
    logger.info("Anexo removido do funcionário", { funcionarioId: params.id, anexoId: params.anexoId });
    return NextResponse.json(apiSuccess({ id: params.anexoId }));
  } catch (error) {
    logger.error("Falha ao remover anexo do funcionário", error, { id: params.id, anexoId: params.anexoId });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
