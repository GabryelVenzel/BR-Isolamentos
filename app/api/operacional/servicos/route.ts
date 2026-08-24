import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** GET: lista serviços, com os filtros do Kanban (etapa, tipo de trabalho,
 * responsável, período). */
export async function GET(request: Request) {
  const ctx = createOperacionalContext(createSupabaseServerClient());
  const { searchParams } = new URL(request.url);

  try {
    const servicos = await ctx.listarServicos({
      etapa: searchParams.get("etapa") ?? undefined,
      tipoTrabalho: searchParams.get("tipo_trabalho") ?? undefined,
      responsavelEmail: searchParams.get("responsavel_email") ?? undefined,
      criadosApartirDe: searchParams.get("criados_a_partir_de") ?? undefined,
    });
    return NextResponse.json(apiSuccess(servicos, { total: servicos.length }));
  } catch (error) {
    logger.error("Falha ao listar serviços", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: cria um serviço a partir de um lead (normalmente fechado) — ver
 * lib/usecases/operacional/criarServico.ts. */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const ctx = createOperacionalContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const servico = await ctx.criarServico(body, user?.email ?? null);
    logger.info("Serviço criado", { id: servico.id, numero: servico.numero_servico });
    return NextResponse.json(apiSuccess(servico), { status: 201 });
  } catch (error) {
    logger.error("Falha ao criar serviço", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
