import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orcamentos")
    .select("*, cliente:clientes(*)")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { id: _id, cliente: _cliente, ...campos } = body;

  const { data, error } = await supabase
    .from("orcamentos")
    .update(campos)
    .eq("id", params.id)
    .select("*, cliente:clientes(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("orcamentos").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
