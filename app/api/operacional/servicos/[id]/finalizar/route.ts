import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: finaliza o serviço — exige foto principal e PDF relatório já
 * anexados (via /anexar) e valor real no corpo. Ver
 * lib/usecases/operacional/finalizarServico.ts pro checklist completo.
 * Corpo: `{ valor_real: number, data_fim_real?: string }`. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createOperacionalContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const servico = await ctx.finalizarServico(params.id, body, user?.email ?? null);
    logger.info("Serviço finalizado", { id: params.id });
    return NextResponse.json(apiSuccess(servico));
  } catch (error) {
    logger.error("Falha ao finalizar serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
