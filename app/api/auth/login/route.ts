import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, password } = await request.json().catch(() => ({}));

  if (!email || !password) {
    return NextResponse.json({ error: "Informe email e senha." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  return NextResponse.json({ user: { email: data.user?.email } });
}
