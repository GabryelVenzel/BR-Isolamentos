import { NextResponse } from "next/server";
import { quantificarMateriais } from "@/lib/quantificador";
import type { QuantificarInput } from "@/lib/types";

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as QuantificarInput | null;

  if (!input || !input.area_m2 || !input.espessura_mm) {
    return NextResponse.json(
      { error: "Informe espessura, área e demais dados de quantificação." },
      { status: 400 }
    );
  }

  const resultado = quantificarMateriais(input);
  return NextResponse.json(resultado);
}
