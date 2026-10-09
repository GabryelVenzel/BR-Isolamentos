import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UsuarioRepository } from "@/lib/repositories";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: usuários ATIVOS (id/email/nome) — alimenta os dropdowns de
 * "Responsável" de Comercial, Operacional e Resumo, por isso é aberto a
 * qualquer usuário ativo. Cadastro, níveis de acesso e a lista completa
 * (com inativos) ficam em /api/rh/usuarios, só pra administradores.
 * Formato de resposta "cru" (array direto), mesmo padrão de /api/clientes. */
export async function GET() {
  const usuarioRepo = new UsuarioRepository(createSupabaseServerClient());

  try {
    const ativos = await usuarioRepo.listarAtivos();
    return NextResponse.json(ativos.map(({ id, email, nome }) => ({ id, email, nome })));
  } catch (error) {
    logger.error("Falha ao listar usuários", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
