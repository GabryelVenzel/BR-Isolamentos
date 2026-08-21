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
    .select("*, cliente:clientes(*)")
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count } = await supabase.from("orcamentos").select("id", { count: "exact", head: true });
  const numero = `ORC-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase
    .from("orcamentos")
    .insert({ ...body, numero, criado_por: user?.email ?? null })
    .select("*, cliente:clientes(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
