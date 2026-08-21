import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("impostos_config").select("*").order("ordem");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// Atualização em lote: [{ id, nome, percentual, ativo, ordem }, ...]. Itens sem `id`
// (novos) são inseridos.
export async function PUT(request: Request) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Envie uma lista de impostos." }, { status: 400 });
  }

  for (const item of body) {
    if (item.id) {
      const { error } = await supabase
        .from("impostos_config")
        .update({
          nome: item.nome,
          percentual: item.percentual,
          ativo: item.ativo ?? true,
          ordem: item.ordem ?? 0,
        })
        .eq("id", item.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from("impostos_config").insert({
        nome: item.nome,
        percentual: item.percentual,
        ativo: item.ativo ?? true,
        ordem: item.ordem ?? 0,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Informe o id do imposto a remover." }, { status: 400 });
  }

  const { error } = await supabase.from("impostos_config").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
