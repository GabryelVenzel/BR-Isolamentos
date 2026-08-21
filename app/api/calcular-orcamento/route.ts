import { NextResponse } from "next/server";
import { calcularOrcamento, OrcamentoConfigError } from "@/lib/orcamento";
import type { CalcularOrcamentoInput } from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as CalcularOrcamentoInput | null;

  if (!input || !input.quantificacao || !input.precos || !input.config) {
    return NextResponse.json(
      { error: "Informe quantificação, preços e configuração da empresa." },
      { status: 400 }
    );
  }

  try {
    const resultado = calcularOrcamento(input);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof OrcamentoConfigError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Erro ao calcular orçamento." }, { status: 500 });
  }
}
