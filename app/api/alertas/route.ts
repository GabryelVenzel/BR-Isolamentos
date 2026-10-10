import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acessoDeMetadata } from "@/lib/acesso";
import { createAlertasContext } from "@/lib/contexts/alertas";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: pendências do usuário logado — só as dos módulos que ele tem
 * liberados (ver lib/contexts/alertas.ts). Alimenta o sino da barra superior. */
export async function GET() {
  const supabase = createSupabaseServerClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(apiError("Sessão expirada. Entre novamente."), { status: 401 });

    const central = await createAlertasContext(supabase).listar(acessoDeMetadata(user.app_metadata));
    return NextResponse.json(apiSuccess(central, { total: central.alertas.length }));
  } catch (error) {
    logger.error("Falha ao listar alertas", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
