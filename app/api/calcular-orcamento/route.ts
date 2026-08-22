import { NextResponse } from "next/server";
import { calcularOrcamento } from "@/lib/usecases/orcamento";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { CalcularOrcamentoInput } from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as CalcularOrcamentoInput | null;

  try {
    if (!input || !input.quantificacao || !input.precos || !input.config) {
      throw new ValidationError("Informe quantificação, preços e configuração da empresa.");
    }

    const resultado = calcularOrcamento(input);
    return NextResponse.json(resultado);
  } catch (error) {
    logger.error("Falha ao calcular orçamento", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
