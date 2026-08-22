import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: lista leads, com os filtros do Kanban (etapa, responsável,
 * temperatura, origem, período). Antes de listar, roda o sweep de
 * reativação de leads frios vencidos — ver
 * lib/usecases/comercial/verificarReativacoesPendentes.ts — pra qualquer
 * agendamento vencido já aparecer reativado (Morno/Contato) nesta mesma
 * resposta, sem precisar de um cron rodando à parte. */
export async function GET(request: Request) {
  const ctx = createComercialContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    await ctx.verificarReativacoesPendentes();

    const leads = await ctx.listarLeads({
      etapa: searchParams.get("etapa") ?? undefined,
      atribuidoA: searchParams.get("atribuido_a") ?? undefined,
      temperatura: searchParams.get("temperatura") ?? undefined,
      origem: searchParams.get("origem") ?? undefined,
      criadosApartirDe: searchParams.get("criados_a_partir_de") ?? undefined,
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
  const supabase = createSupabaseServerClient();
  const ctx = createComercialContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const lead = await ctx.criarLead(body, user?.email ?? null);
    logger.info("Lead criado", { id: lead.id, cliente_id: lead.cliente_id });
    return NextResponse.json(apiSuccess(lead), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar lead", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
