// Use case: cálculo financeiro final do orçamento (materiais + mão de obra +
// deslocamento + hospedagem + frete, impostos "completos" do regime
// tributário configurado + margem, método markup divisor). A lógica de
// cálculo em si mora em `lib/orcamento.ts` — este use case só adapta o erro de
// configuração de negócio (`OrcamentoConfigError`) para a hierarquia comum de
// `lib/errors.ts`, para que a API route trate todos os erros de forma
// uniforme (ver `lib/errors.ts`).
//
// IMPORTANTE: este cálculo usa a carga tributária REAL e completa (Simples
// Nacional pela fórmula oficial da LC 123/2006, ou Lucro Presumido/
// Personalizado somando cada imposto configurado) — nunca simplificar para um
// percentual único aproximado. Ver `lib/tributos.ts`.

import { ConfigurationError } from "../../errors";
import { calcularOrcamento as calcularOrcamentoFinanceiro, OrcamentoConfigError } from "../../orcamento";
import type { CalcularOrcamentoInput, CalcularOrcamentoResultado } from "../../types";

export function calcularOrcamento(input: CalcularOrcamentoInput): CalcularOrcamentoResultado {
  try {
    return calcularOrcamentoFinanceiro(input);
  } catch (error) {
    if (error instanceof OrcamentoConfigError) {
      throw new ConfigurationError(error.message);
    }
    throw error;
  }
}
