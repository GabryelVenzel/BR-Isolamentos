import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAcessosContext } from "@/lib/contexts/acessos";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: cria o login de quem ainda não tem, ou redefine a senha — sempre
 * provisória (o usuário troca no próximo acesso). */
export async function POST(request: Request, { params }: Params) {
  const ctx = createAcessosContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);
  try {
    await ctx.definirSenha(params.id, body);
    logger.info("Senha provisória definida", { id: params.id });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    logger.error("Falha ao definir senha provisória", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
