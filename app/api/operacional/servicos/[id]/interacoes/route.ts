import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = createOperacionalContext(createSupabaseServerClient());

  try {
    const interacoes = await ctx.listarInteracoesServico(params.id);
    return NextResponse.json(apiSuccess(interacoes));
  } catch (error) {
    logger.error("Falha ao listar interações do serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}

export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createOperacionalContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const interacao = await ctx.registrarInteracaoServico({
      ...body,
      servico_id: params.id,
      autor_email: body?.autor_email ?? user?.email ?? null,
    });
    logger.info("Interação registrada no serviço", { servicoId: params.id, tipo: interacao.tipo });
    return NextResponse.json(apiSuccess(interacao), { status: 201 });
  } catch (error) {
    logger.error("Falha ao registrar interação no serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
