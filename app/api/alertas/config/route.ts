import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAlertasContext } from "@/lib/contexts/alertas";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** PUT: altera os prazos de antecedência dos alertas — só administrador (a
 * regra de rota em lib/acesso.ts barra os demais, e o banco também). */
export async function PUT(request: Request) {
  const ctx = createAlertasContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);
  try {
    const config = await ctx.atualizarConfig(body);
    logger.info("Prazos de alerta atualizados", { ...config });
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    logger.error("Falha ao atualizar prazos de alerta", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
