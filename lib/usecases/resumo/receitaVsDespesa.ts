import type { LancamentoFinanceiroRepository } from "../../repositories";
import type { PontoReceitaDespesa } from "../../types/resumo";

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Receita/despesa/lucro dos últimos `meses` meses (padrão 6, fixo — não
 * segue o período da FilterBar, igual ao pedido original: "últimos 6
 * meses" é o recorte fixo desse gráfico específico). Agrega em memória
 * porque o query builder do supabase-js não expressa "GROUP BY mês" sem uma
 * função SQL dedicada — ver `LancamentoFinanceiroRepository.listarValoresPorTipo`. */
export async function receitaVsDespesa(
  repo: LancamentoFinanceiroRepository,
  opts: { tipoTrabalho?: string; responsavel?: string } = {},
  meses = 6
): Promise<PontoReceitaDespesa[]> {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);
  const dataInicio = inicio.toISOString().slice(0, 10);
  const dataFim = hoje.toISOString().slice(0, 10);

  const [receitas, despesas] = await Promise.all([
    repo.listarValoresPorTipo("receita", dataInicio, dataFim, opts),
    repo.listarValoresPorTipo("despesa", dataInicio, dataFim, opts),
  ]);

  const pontos: PontoReceitaDespesa[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}`;
    const receita = receitas
      .filter((l) => l.data.slice(0, 7) === chave)
      .reduce((acc, l) => acc + l.valor, 0);
    const despesa = despesas
      .filter((l) => l.data.slice(0, 7) === chave)
      .reduce((acc, l) => acc + l.valor, 0);

    pontos.push({
      mes: `${MESES_ABREV[mes.getMonth()]}/${String(mes.getFullYear()).slice(2)}`,
      receita,
      despesa,
      lucro: receita - despesa,
    });
  }

  return pontos;
}
