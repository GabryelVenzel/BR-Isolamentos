import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createComercialContext } from "@/lib/contexts/comercial";
import { apiError, apiSuccess } from "@/lib/types/common";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Params {
  params: { id: string };
}

/** POST: muda a temperatura do lead. Se a nova temperatura for "frio",
 * agenda automaticamente uma reativação (ver
 * lib/usecases/comercial/mudarTemperatura.ts) — o prazo vem da configuração
 * por etapa, ou de `intervaloDiasCustom` se informado no corpo (campo
 * "Custom: [___] dias" do mockup).
 * Corpo: `{ novaTemperatura: TemperaturaLead, intervaloDiasCustom?: number }`. */
export async function POST(request: Request, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const ctx = createComercialContext(supabase);
  const body = await request.json().catch(() => null);

  try {
    if (!body?.novaTemperatura) throw new ValidationError("Informe a nova temperatura.");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const resultado = await ctx.mudarTemperatura(
      params.id,
      body.novaTemperatura,
      body.intervaloDiasCustom,
      user?.email ?? null
    );
    logger.info("Temperatura do lead alterada", { id: params.id, novaTemperatura: body.novaTemperatura });
    return NextResponse.json(apiSuccess(resultado));
  } catch (error) {
    logger.error("Falha ao mudar temperatura do lead", error, { id: params.id });
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
