import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOperacionalContext } from "@/lib/contexts/operacional";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: move o serviço entre Planejamento ⇄ Execução. Mover pra
 * "Finalizado" é rejeitado aqui de propósito — passa pelo checklist da rota
 * /finalizar (ver lib/usecases/operacional/moverServico.ts). Corpo:
 * `{ novaEtapa: EtapaServico }`. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createOperacionalContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    if (!body?.novaEtapa) throw new ValidationError("Informe a nova etapa.");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const servico = await ctx.moverServico(params.id, body.novaEtapa, user?.email ?? null);
    logger.info("Serviço movido de etapa", { id: params.id, novaEtapa: body.novaEtapa });
    return NextResponse.json(apiSuccess(servico));
  } catch (error) {
    logger.error("Falha ao mover serviço", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
