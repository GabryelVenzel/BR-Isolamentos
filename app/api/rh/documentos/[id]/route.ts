import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRhContext } from "@/lib/contexts/rh";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** PATCH: renomeia o documento (pedido explícito: "lista que pode ser
 * excluída ou editada") — o arquivo em si não muda por aqui, só o nome. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = createRhContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const documento = await ctx.renomearDocumentoEmpresa(params.id, body);
    logger.info("Documento da empresa renomeado", { id: params.id });
    return NextResponse.json(apiSuccess(documento));
  } catch (error) {
    logger.error("Falha ao renomear documento da empresa", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** DELETE: remove o registro — o arquivo em si já foi removido do Storage
 * pelo chamador antes desta chamada (ver DocumentosEmpresa.tsx). */
export async function DELETE(_request: Request, { params }: Params) {
  const ctx = createRhContext(createSupabaseServerClient());

  try {
    await ctx.removerDocumentoEmpresa(params.id);
    logger.info("Documento da empresa excluído", { id: params.id });
    return NextResponse.json(apiSuccess({ id: params.id }));
  } catch (error) {
    logger.error("Falha ao excluir documento da empresa", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
