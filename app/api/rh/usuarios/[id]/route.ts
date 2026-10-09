import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAcessosContext } from "@/lib/contexts/acessos";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** PATCH: edita nome/telefone, nível de acesso (administrador + módulos) ou
 * ativa/desativa. Não há DELETE: desativar preserva o histórico de leads,
 * serviços e registros atribuídos à pessoa. */
export async function PATCH(request: Request, { params }: Params) {
  const ctx = createAcessosContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);
  try {
    const usuario = await ctx.atualizarUsuario(params.id, body);
    logger.info("Usuário atualizado", { id: params.id });
    return NextResponse.json(apiSuccess(usuario));
  } catch (error) {
    logger.error("Falha ao atualizar usuário", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
