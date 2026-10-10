import type { LancamentoFinanceiro, Servico } from "../../types/domain";

/** Resultado financeiro de uma obra: o que foi orçado contra o que de fato
 * entrou e saiu nos lançamentos ligados a ela (`servico_id`). */
export interface ResultadoObra {
  servicoId: string;
  numero: string;
  cliente: string | null;
  etapa: Servico["etapa"];
  orcado: number;
  /** Receitas ligadas à obra — total lançado e quanto já entrou. */
  receita: number;
  recebido: number;
  /** Despesas ligadas à obra — total lançado e quanto já saiu. */
  despesa: number;
  pago: number;
  /** Receita lançada − despesa lançada. */
  margem: number;
  /** Margem sobre a receita lançada; `null` sem receita. */
  margemPercentual: number | null;
  /** Despesa lançada sobre o valor orçado; `null` sem orçado. */
  consumoDoOrcadoPercentual: number | null;
}

type LancamentoDaObra = Pick<LancamentoFinanceiro, "servico_id" | "tipo" | "valor" | "pago">;

export function calcularResultadoObra(servico: Servico, lancamentos: LancamentoDaObra[]): ResultadoObra {
  let receita = 0;
  let recebido = 0;
  let despesa = 0;
  let pago = 0;

  for (const l of lancamentos) {
    if (l.servico_id !== servico.id) continue;
    if (l.tipo === "receita") {
      receita += l.valor;
      if (l.pago) recebido += l.valor;
    } else {
      despesa += l.valor;
      if (l.pago) pago += l.valor;
    }
  }

  const orcado = servico.valor_orcado ?? 0;
  const margem = receita - despesa;
  return {
    servicoId: servico.id,
    numero: servico.numero_servico,
    cliente: servico.cliente?.nome ?? null,
    etapa: servico.etapa,
    orcado,
    receita,
    recebido,
    despesa,
    pago,
    margem,
    margemPercentual: receita > 0 ? (margem / receita) * 100 : null,
    consumoDoOrcadoPercentual: orcado > 0 ? (despesa / orcado) * 100 : null,
  };
}

/** Uma linha por obra, as mais recentes primeiro (ordem em que `servicos` chega). */
export function calcularResultadoPorObra(servicos: Servico[], lancamentos: LancamentoDaObra[]): ResultadoObra[] {
  return servicos.map((servico) => calcularResultadoObra(servico, lancamentos));
}
