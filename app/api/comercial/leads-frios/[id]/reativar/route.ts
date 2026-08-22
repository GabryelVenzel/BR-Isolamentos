import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: reativa manualmente um lead frio agendado (botão "Reativar agora")
 * — muda temperatura para Morno e etapa para Contato, antes do prazo
 * agendado vencer. */
export async function POST(_request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createComercialContext(supabase);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const lead = await ctx.reativarLeadFrio(params.id, user?.email ?? null);
    logger.info("Lead frio reativado manualmente", { agendamentoId: params.id, leadId: lead.id });
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    logger.error("Falha ao reativar lead frio", error, { agendamentoId: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
