import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DOMINIO_EMAIL, acessoDeMetadata, emailPermitido, rotaInicial } from "@/lib/acesso";

export async function POST(request: Request) {
  const { email: informado, password } = await request.json().catch(() => ({}));

  if (typeof informado !== "string" || typeof password !== "string" || !informado.trim() || !password) {
    return NextResponse.json({ error: "Informe o e-mail e a senha." }, { status: 400 });
  }

  const email = informado.trim().toLowerCase();
  if (!emailPermitido(email)) {
    return NextResponse.json({ error: `Use o seu e-mail @${DOMINIO_EMAIL}.` }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // Mesma mensagem pra e-mail inexistente e senha errada, de propósito — não
    // revela quais e-mails têm conta.
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const acesso = acessoDeMetadata(data.user?.app_metadata);
  if (!acesso.ativo) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Seu acesso está desativado. Fale com o administrador." }, { status: 403 });
  }

  return NextResponse.json({
    user: { email: data.user?.email },
    destino: acesso.trocarSenha ? "/conta/senha" : rotaInicial(acesso) ?? "/sem-acesso",
  });
}
