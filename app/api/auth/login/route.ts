import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverEmailDeLogin } from "@/lib/auth-usuarios";

export async function POST(request: Request) {
  const { email: identificador, password } = await request.json().catch(() => ({}));

  if (!identificador || !password) {
    return NextResponse.json({ error: "Informe usuário/email e senha." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  // O campo de login aceita tanto um "usuário" (ex.: BR-ISOLAMENTO) quanto o email
  // direto — resolve para o email real antes de chamar o Supabase Auth.
  const email = resolverEmailDeLogin(identificador);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  return NextResponse.json({ user: { email: data.user?.email } });
}
