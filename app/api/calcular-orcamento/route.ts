import { NextResponse } from "next/server";
import { calcularOrcamento } from "@/lib/orcamento";
import type { CalcularOrcamentoInput } from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as CalcularOrcamentoInput | null;

  if (!input || !input.quantificacao || !input.precos || !input.config) {
    return NextResponse.json(
      { error: "Informe quantificação, preços e configuração da empresa." },
      { status: 400 }
    );
  }

  const resultado = calcularOrcamento(input);
  return NextResponse.json(resultado);
}
