import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** GET: timeline de interações do lead. */
export async function GET(_request: Request, { params }: Params) {
  const ctx = createComercialContext(createSupabaseServerClient());

  try {
    const interacoes = await ctx.listarInteracoes(params.id);
    return NextResponse.json(apiSuccess(interacoes));
  } catch (error) {
    logger.error("Falha ao listar interações do lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

/** POST: registra uma nova interação (nota, ligação, e-mail...) na timeline. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createComercialContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const interacao = await ctx.registrarInteracao({
      ...body,
      lead_id: params.id,
      autor_email: body?.autor_email ?? user?.email ?? null,
    });
    logger.info("Interação registrada", { leadId: params.id, tipo: interacao.tipo });
    return NextResponse.json(apiSuccess(interacao), { status: 201 });
  } catch (error) {
    logger.error("Falha ao registrar interação", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
