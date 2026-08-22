import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: agendamentos de reativação ainda pendentes ("Leads Frios em
 * Reativação" — ver LeadsFriosPanel.tsx). Roda o sweep de reativação antes
 * de listar (mesmo motivo de GET /api/comercial/leads), então um
 * agendamento recém-vencido não aparece mais aqui nesta mesma resposta. */
export async function GET() {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    const agendamentos = await ctx.listarLeadsFrios();
    return NextResponse.json(apiSuccess(agendamentos, { total: agendamentos.length }));
  } catch (error) {
    logger.error("Falha ao listar leads frios", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
