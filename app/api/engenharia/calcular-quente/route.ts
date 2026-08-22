import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calcularQuente } from "@/lib/usecases/engenharia";
import { apiError, apiSuccess } from "@/lib/types/common";
import { NotFoundError, toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Acabamento, MaterialIsolante } from "@/lib/types";

/** POST: painel "Quente" da calculadora rápida (módulo Engenharia). Busca
 * material/acabamento (tabelas de referência, sem repositório dedicado —
 * mesmo padrão de app/api/materiais e app/api/acabamentos) e delega o
 * cálculo físico a lib/usecases/engenharia/calcularQuente.ts. */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const body = await request.json().catch(() => null);

  try {
    if (!body?.material_id) throw new ValidationError("Material isolante é obrigatório.");
    if (!body?.acabamento_id) throw new ValidationError("Acabamento externo é obrigatório.");

    const [{ data: material, error: erroMaterial }, { data: acabamento, error: erroAcabamento }] = await Promise.all([
      supabase.from("materiais_isolantes").select("*").eq("id", body.material_id).maybeSingle(),
      supabase.from("acabamentos").select("*").eq("id", body.acabamento_id).maybeSingle(),
    ]);

    if (erroMaterial) throw erroMaterial;
    if (erroAcabamento) throw erroAcabamento;
    if (!material) throw new NotFoundError("Material isolante não encontrado.");
    if (!acabamento) throw new NotFoundError("Acabamento externo não encontrado.");

    const resultado = calcularQuente(body, {
      material: material as MaterialIsolante,
      acabamento: acabamento as Acabamento,
    });
    return NextResponse.json(apiSuccess(resultado));
  } catch (error) {
    logger.error("Falha ao calcular painel quente (Engenharia)", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json(apiError(message), { status: statusCode });
  }
}
