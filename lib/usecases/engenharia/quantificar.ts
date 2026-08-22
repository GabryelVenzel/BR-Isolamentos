// Use case: quantificação de materiais para um trecho de orçamento a partir da
// espessura/área calculadas em `calcularTermico`. Fina camada de validação em
// cima de `lib/quantificador.ts` (mantém a função pura de cálculo sem
// depender de `lib/errors.ts`, para poder ser testada isoladamente).

import { ValidationError } from "../../errors";
import { quantificarMateriais } from "../../quantificador";
import type { QuantificarInput, QuantificarResultado } from "../../types";

export function quantificar(input: QuantificarInput): QuantificarResultado {
  if (!input || !input.area_m2 || !input.espessura_mm) {
    throw new ValidationError("Informe espessura, área e demais dados de quantificação.");
  }
  return quantificarMateriais(input);
}
