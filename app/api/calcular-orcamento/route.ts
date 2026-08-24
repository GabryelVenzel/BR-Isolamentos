import { NextResponse } from "next/server";
import { calcularOrcamento } from "@/lib/usecases/orcamento";
import { toHttpError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { CalcularOrcamentoInput } from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as CalcularOrcamentoInput | null;

  try {
    const temMateriais = input?.valor_materiais_direto !== undefined || (input?.quantificacao && input?.precos);
    if (!input || !temMateriais || !input.config) {
      throw new ValidationError(
        "Informe o custo de materiais (valor direto ou quantificação + preços) e a configuração da empresa."
      );
    }

    const resultado = calcularOrcamento(input);
    return NextResponse.json(resultado);
  } catch (error) {
    logger.error("Falha ao calcular orçamento", error);
    const { message, statusCode } = toHttpError(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
