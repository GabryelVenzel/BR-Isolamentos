import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Lista simples de usuários ativos (id/email/nome) — usada pelo filtro
 * "Responsável" do dashboard executivo (módulo Resumo). Formato de resposta
 * "cru" (array direto), mesmo padrão das outras rotas de lookup simples
 * (/api/materiais, /api/acabamentos). */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, nome")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
