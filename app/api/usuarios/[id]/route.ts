import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UsuarioRepository } from "@/lib/repositories";
import { UpdateUsuarioSchema, parseOrThrow } from "@/lib/validators";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** PATCH: edita nome/telefone, ou ativa/desativa um responsável (aba
 * Configurações). `email` não é editável aqui de propósito — ver comentário
 * em lib/validators/usuario.ts. Desativar (`ativo: false`) é o jeito de
 * "remover" um responsável do dropdown sem quebrar a referência de
 * leads/orçamentos já atribuídos a ele (não há DELETE — a FK
 * leads.atribuido_a/orcamentos.atribuido_a → usuarios(email) bloquearia
 * qualquer exclusão de alguém com histórico). */
export async function PATCH(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const usuarioRepo = new UsuarioRepository(supabase);
  const body = await request.json().catch(() => null);

  try {
    const dados = parseOrThrow(UpdateUsuarioSchema, body);
    const usuario = await usuarioRepo.update(params.id, dados);
    logger.info("Responsável atualizado", { id: params.id });
    return NextResponse.json(usuario);
  } catch (error) {
    logger.error("Falha ao atualizar responsável", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
