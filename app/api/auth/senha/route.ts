import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const TAMANHO_MINIMO_SENHA = 8;

/** POST: o usuário logado define a própria senha — obrigatório no primeiro
 * acesso com senha provisória (`app_metadata.trocar_senha`, ver middleware.ts)
 * e disponível a qualquer momento em /conta/senha. */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);
  const novaSenha = typeof body?.novaSenha === "string" ? body.novaSenha : "";

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(apiError("Sessão expirada. Entre novamente."), { status: 401 });

    if (novaSenha.length < TAMANHO_MINIMO_SENHA) {
      return NextResponse.json(apiError(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`), { status: 400 });
    }

    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      const mesma = /different from the old/i.test(error.message);
      return NextResponse.json(apiError(mesma ? "A nova senha precisa ser diferente da atual." : "Não foi possível alterar a senha."), {
        status: 400,
      });
    }

    if (user.app_metadata?.trocar_senha === true) {
      const admin = createSupabaseAdminClient();
      const { error: erroMeta } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, trocar_senha: false },
      });
      if (erroMeta) throw erroMeta;
    }

    logger.info("Senha alterada pelo próprio usuário", { email: user.email });
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    logger.error("Falha ao alterar senha", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
