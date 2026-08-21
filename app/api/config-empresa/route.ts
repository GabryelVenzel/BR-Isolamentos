import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("config_empresa").select("*").limit(1).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return NextResponse.json({ error: "Configuração inválida." }, { status: 400 });
  }

  const { id, ...campos } = body;
  const { data, error } = await supabase
    .from("config_empresa")
    .update(campos)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
