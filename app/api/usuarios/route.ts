import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UsuarioRepository } from "@/lib/repositories";
import { CreateUsuarioSchema, parseOrThrow } from "@/lib/validators";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: lista de usuários (roster de responsáveis do CRM — não é uma tabela
 * de credenciais, ver lib/repositories/usuario.repository.ts). Por padrão só
 * ativos (id/email/nome) — usado pelo filtro "Responsável" do dashboard
 * Resumo e do Kanban Comercial. `?todos=1` traz todos (ativos e inativos,
 * com telefone/ativo também) — usado pela aba Configurações → Responsáveis.
 * Formato de resposta "cru" (array direto), mesmo padrão de /api/clientes. */
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const usuarioRepo = new UsuarioRepository(supabase);
  const { searchParams } = new URL(request.url);

  try {
    if (searchParams.get("todos")) {
      const data = await usuarioRepo.listarTodos();
      return NextResponse.json(data);
    }

    const { data, error } = await supabase.from("usuarios").select("id, email, nome").eq("ativo", true).order("nome");
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Falha ao listar usuários", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

/** POST: cadastra um novo responsável (nome/email/telefone) — aba
 * Configurações → Responsáveis. NÃO cria acesso de login (isso é feito
 * manualmente no Supabase Auth, fora desta tela). */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const usuarioRepo = new UsuarioRepository(supabase);
  const body = await request.json().catch(() => null);

  try {
    const dados = parseOrThrow(CreateUsuarioSchema, body);
    const usuario = await usuarioRepo.create({
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone ?? null,
      role: "consultor",
      ativo: true,
    });
    logger.info("Responsável cadastrado", { email: usuario.email });
    return NextResponse.json(usuario, { status: 201 });
  } catch (error) {
    logger.error("Falha ao cadastrar responsável", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
