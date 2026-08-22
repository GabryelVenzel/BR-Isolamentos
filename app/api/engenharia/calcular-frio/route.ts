import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calcularFrio } from "@/lib/usecases/engenharia";
import { apiError, apiSuccess } from "@/lib/types/common";
import { NotFoundError, toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { MaterialIsolante } from "@/lib/types";

/** POST: painel "Frio" (prevenção de condensação) da calculadora rápida
 * (módulo Engenharia). Não busca acabamento — emissividade é fixa em 0.9
 * (fiel ao painel Frio do CALCULADORA-TERMICA.py, ver
 * lib/usecases/engenharia/calcularFrio.ts). */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);

  try {
    if (!body?.material_id) throw new ValidationError("Material isolante é obrigatório.");

    const { data: material, error: erroMaterial } = await supabase
      .from("materiais_isolantes")
      .select("*")
      .eq("id", body.material_id)
      .maybeSingle();

    if (erroMaterial) throw erroMaterial;
    if (!material) throw new NotFoundError("Material isolante não encontrado.");

    const resultado = calcularFrio(body, { material: material as MaterialIsolante });
    return NextResponse.json(apiSuccess(resultado));
  } catch (error) {
    logger.error("Falha ao calcular painel frio (Engenharia)", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
