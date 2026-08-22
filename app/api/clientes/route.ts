import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClienteRepository } from "@/lib/repositories";
import { CreateClienteSchema, parseOrThrow } from "@/lib/validators";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// Não fazia parte da árvore de rotas do prompt original, mas é necessário
// para o step-1 do wizard (buscar/criar cliente) e para a tabela `clientes`
// definida no schema.
//
// Mantém o formato de resposta "cru" (array/objeto direto, sem envelope
// {success, data, error}) por compatibilidade com o frontend existente — ver
// `lib/CONVENTIONS.md`.

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const clienteRepo = new ClienteRepository(supabase);
  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("busca");

  try {
    const data = busca
      ? await clienteRepo.buscarPorNome(busca)
      : await clienteRepo.findAll({ orderBy: "nome" });
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Falha ao listar clientes", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const clienteRepo = new ClienteRepository(supabase);
  const body = await request.json().catch(() => null);

  try {
    const dados = parseOrThrow(CreateClienteSchema, body);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const cliente = await clienteRepo.create({
      ...dados,
      email: dados.email ?? null,
      telefone: dados.telefone ?? null,
      endereco: dados.endereco ?? null,
      cnpj_cpf: dados.cnpj_cpf ?? null,
      criado_por: user?.email ?? null,
    });

    logger.info("Cliente criado", { id: cliente.id });
    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar cliente", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
