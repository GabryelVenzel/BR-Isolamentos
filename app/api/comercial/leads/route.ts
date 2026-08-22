import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: lista leads (opcionalmente filtrados por etapa/responsável). */
export async function GET(request: Request) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const leads = await ctx.listarLeads({
      etapa: searchParams.get("etapa") ?? undefined,
      atribuidoA: searchParams.get("atribuido_a") ?? undefined,
    });
    return NextResponse.json(apiSuccess(leads, { total: leads.length }));
  } catch (error) {
    logger.error("Falha ao listar leads", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: cria um lead novo (etapa default "prospeccao" se omitida). */
export async function POST(request: Request) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const body = await request.json().catch(() => null);

  try {
    const lead = await ctx.criarLead(body);
    logger.info("Lead criado", { id: lead.id, cliente_id: lead.cliente_id });
    return NextResponse.json(apiSuccess(lead), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar lead", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
