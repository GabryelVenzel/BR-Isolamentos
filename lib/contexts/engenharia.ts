// Contexto de negócio do módulo Engenharia: cálculo térmico (ASTM C680/ISO
// 12241/ABNT NBR 16281) e quantificação de materiais para um trecho de
// orçamento. Não depende de Supabase — os cálculos são puramente funcionais,
// então o contexto aqui é só um agrupador de conveniência (mesmo formato dos
// outros módulos, para quem for ler o código pela primeira vez encontrar o
// mesmo padrão em todo canto).

import { calcularTermico, quantificar } from "../usecases/engenharia";
import type {
  CalcularTermicoInput,
  CalcularTermicoResultadoFrio,
  CalcularTermicoResultadoQuente,
  QuantificarInput,
  QuantificarResultado,
} from "../types";

export function createEngenhariaContext() {
  return {
    calcularTermico(
      input: CalcularTermicoInput
    ): CalcularTermicoResultadoQuente | CalcularTermicoResultadoFrio {
      return calcularTermico(input);
    },

    quantificar(input: QuantificarInput): QuantificarResultado {
      return quantificar(input);
    },
  };
}

export type EngenhariaContext = ReturnType<typeof createEngenhariaContext>;
