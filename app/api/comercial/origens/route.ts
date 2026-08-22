import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: origens distintas já usadas em algum lead — popula o filtro
 * "Origem" do Kanban sem hardcodar uma lista fixa (é texto livre, ver
 * CreateLeadSchema em lib/validators/lead.ts). */
export async function GET() {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    const origens = await ctx.listarOrigens();
    return NextResponse.json(apiSuccess(origens));
  } catch (error) {
    logger.error("Falha ao listar origens de leads", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
