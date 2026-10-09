import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAcessosContext } from "@/lib/contexts/acessos";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: todos os usuários (ativos e inativos) com a situação do login de
 * cada um — só administradores (ver lib/contexts/acessos.ts). */
export async function GET() {
  const ctx = createAcessosContext(createSupabaseServerClient());
  try {
    const usuarios = await ctx.listarUsuarios();
    return NextResponse.json(apiSuccess(usuarios, { total: usuarios.length }));
  } catch (error) {
    logger.error("Falha ao listar usuários", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: cadastra um usuário; com `senha`, já cria o login junto. */
export async function POST(request: Request) {
  const ctx = createAcessosContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);
  try {
    const usuario = await ctx.criarUsuario(body);
    logger.info("Usuário cadastrado", { email: usuario.email });
    return NextResponse.json(apiSuccess(usuario), { status: 201 });
  } catch (error) {
    logger.error("Falha ao cadastrar usuário", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
