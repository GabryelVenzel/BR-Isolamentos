import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Não fazia parte da árvore de rotas do prompt original, mas é necessário
// para o step-1 do wizard (buscar/criar cliente) e para a tabela `clientes`
// definida no schema.

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("busca");

  let query = supabase.from("clientes").select("*").order("nome");
  if (busca) {
    query = query.ilike("nome", `%${busca}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);

  if (!body?.nome) {
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome: body.nome,
      email: body.email ?? null,
      telefone: body.telefone ?? null,
      endereco: body.endereco ?? null,
      cnpj_cpf: body.cnpj_cpf ?? null,
      criado_por: user?.email ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
