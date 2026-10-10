// Regras PURAS de valor de um lead, usadas por telas e relatórios.

import type { Lead } from "./types/domain";

type LeadComValores = Pick<Lead, "etapa" | "eh_comissao" | "valor_estimado" | "valor_comissao" | "valor_fechado">;

/** O valor que representa o lead em cartões, somas de coluna e indicadores:
 *
 *   - lead de comissão → o valor da comissão (não é uma venda da empresa);
 *   - lead FECHADO     → o valor fechado (migração 043), informado no
 *                        fechamento — pode diferir do orçamento vinculado
 *                        (proposta por metro/unidade, desconto negociado);
 *   - demais           → o valor estimado do cartão.
 *
 * Lead fechado antes da migração 043 sem valor fechado cai no estimado. */
export function valorDoLead(lead: LeadComValores): number {
  if (lead.eh_comissao) return lead.valor_comissao ?? 0;
  if (lead.etapa === "fechado" && lead.valor_fechado != null) return lead.valor_fechado;
  return lead.valor_estimado;
}

/** Ao fechar, o lead precisa de um valor fechado? Comissão não: o valor dela
 * já é calculado (valor indicado × percentual). */
export function exigeValorFechado(lead: Pick<Lead, "eh_comissao">): boolean {
  return !lead.eh_comissao;
}
