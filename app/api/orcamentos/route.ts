import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const clienteId = searchParams.get("cliente_id");
  const dataInicio = searchParams.get("data_inicio");
  const dataFim = searchParams.get("data_fim");

  let query = supabase
    .from("orcamentos")
    .select("*, cliente:clientes(*), itens:itens_orcamento(*)")
    .order("criado_em", { ascending: false });

  if (status) query = query.eq("status", status);
  if (clienteId) query = query.eq("cliente_id", clienteId);
  if (dataInicio) query = query.gte("data_criacao", dataInicio);
  if (dataFim) query = query.lte("data_criacao", dataFim);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);

  if (!body?.cliente_id) {
    return NextResponse.json({ error: "Orçamento sem cliente vinculado." }, { status: 400 });
  }
  if (!Array.isArray(body.itens) || body.itens.length === 0) {
    return NextResponse.json({ error: "Orçamento precisa de ao menos um item/trecho." }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count } = await supabase.from("orcamentos").select("id", { count: "exact", head: true });
  const numero = `ORC-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { itens, ...cabecalho } = body;

  const { data: orcamento, error: erroOrcamento } = await supabase
    .from("orcamentos")
    .insert({ ...cabecalho, numero, criado_por: user?.email ?? null })
    .select()
    .single();

  if (erroOrcamento) {
    return NextResponse.json({ error: erroOrcamento.message }, { status: 500 });
  }

  const { error: erroItens } = await supabase
    .from("itens_orcamento")
    .insert(itens.map((item: Record<string, unknown>) => ({ ...item, orcamento_id: orcamento.id })));

  if (erroItens) {
    // evita orçamento órfão sem itens
    await supabase.from("orcamentos").delete().eq("id", orcamento.id);
    return NextResponse.json({ error: erroItens.message }, { status: 500 });
  }

  const { data: completo } = await supabase
    .from("orcamentos")
    .select("*, cliente:clientes(*), itens:itens_orcamento(*)")
    .eq("id", orcamento.id)
    .single();

  return NextResponse.json(completo ?? orcamento, { status: 201 });
}
