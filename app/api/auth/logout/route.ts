import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: "Não foi possível encerrar a sessão." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
