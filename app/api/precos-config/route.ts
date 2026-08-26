import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("precos_config").select("*").order("tipo_material").order("ordem");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// Atualização em lote: [{ id, preco_unitario, densidade_kg_m3?, ativo? }, ...]
export async function PUT(request: Request) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Envie uma lista de preços a atualizar." }, { status: 400 });
  }

  for (const item of body) {
    if (!item.id) continue;
    const { error } = await supabase
      .from("precos_config")
      .update({
        preco_unitario: item.preco_unitario,
        densidade_kg_m3: item.densidade_kg_m3 ?? null,
        ativo: item.ativo ?? true,
      })
      .eq("id", item.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
