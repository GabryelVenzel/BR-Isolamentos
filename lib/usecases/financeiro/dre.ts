import type { LancamentoFinanceiro } from "../../types/domain";

// DRE simplificado (demonstrativo de resultado) por mês de COMPETÊNCIA:
//
//   Receitas (por categoria)
//   (−) Custos variáveis (por categoria)
//   = Margem de contribuição
//   (−) Custos fixos
//   = Resultado
//
// "Custo fixo" segue a mesma convenção do resto do financeiro
// (calcularCustosFixosVsVariaveis): despesa lançada na categoria "Custo fixo"
// — é como os custos fixos do mês entram como lançamento. Todo o resto das
// despesas é custo variável. Regime de competência: conta o lançamento no mês
// a que ele pertence, pago ou não.

const CATEGORIA_CUSTO_FIXO = "Custo fixo";

export interface LinhaDre {
  rotulo: string;
  /** Um valor por mês, na ordem de `Dre.meses`. */
  valores: number[];
  total: number;
}

export interface Dre {
  /** Meses do período, "YYYY-MM", em ordem. */
  meses: string[];
  receitas: LinhaDre[];
  totalReceitas: LinhaDre;
  custosVariaveis: LinhaDre[];
  totalCustosVariaveis: LinhaDre;
  margemContribuicao: LinhaDre;
  custosFixos: LinhaDre;
  resultado: LinhaDre;
}

type LancamentoDre = Pick<LancamentoFinanceiro, "tipo" | "categoria" | "valor" | "data_competencia">;

/** Todos os meses entre duas datas (YYYY-MM-DD), inclusive, como "YYYY-MM". */
export function mesesDoIntervalo(dataInicio: string, dataFim: string): string[] {
  const [anoI, mesI] = dataInicio.split("-").map(Number);
  const [anoF, mesF] = dataFim.split("-").map(Number);
  const meses: string[] = [];
  let ano = anoI;
  let mes = mesI;
  while (ano < anoF || (ano === anoF && mes <= mesF)) {
    meses.push(`${ano}-${String(mes).padStart(2, "0")}`);
    if (mes === 12) {
      ano++;
      mes = 1;
    } else {
      mes++;
    }
  }
  return meses;
}

function linha(rotulo: string, valores: number[]): LinhaDre {
  return { rotulo, valores, total: valores.reduce((soma, v) => soma + v, 0) };
}

function somar(rotulo: string, linhas: LinhaDre[], quantidadeMeses: number): LinhaDre {
  return linha(
    rotulo,
    Array.from({ length: quantidadeMeses }, (_, i) => linhas.reduce((soma, l) => soma + l.valores[i], 0))
  );
}

function subtrair(rotulo: string, a: LinhaDre, b: LinhaDre): LinhaDre {
  return linha(rotulo, a.valores.map((v, i) => v - b.valores[i]));
}

/** Agrupa por categoria, com um valor por mês; categorias de maior total primeiro. */
function porCategoria(lancamentos: LancamentoDre[], meses: string[]): LinhaDre[] {
  const indiceDoMes = new Map(meses.map((m, i) => [m, i]));
  const mapa = new Map<string, number[]>();
  for (const l of lancamentos) {
    const i = indiceDoMes.get(l.data_competencia.slice(0, 7));
    if (i === undefined) continue; // fora do período
    const valores = mapa.get(l.categoria) ?? new Array<number>(meses.length).fill(0);
    valores[i] += l.valor;
    mapa.set(l.categoria, valores);
  }
  return [...mapa.entries()].map(([categoria, valores]) => linha(categoria, valores)).sort((a, b) => b.total - a.total);
}

export function calcularDre(lancamentos: LancamentoDre[], dataInicio: string, dataFim: string): Dre {
  const meses = mesesDoIntervalo(dataInicio, dataFim);
  const n = meses.length;

  const receitas = porCategoria(lancamentos.filter((l) => l.tipo === "receita"), meses);
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");
  const custosVariaveis = porCategoria(despesas.filter((l) => l.categoria !== CATEGORIA_CUSTO_FIXO), meses);
  const fixos = porCategoria(despesas.filter((l) => l.categoria === CATEGORIA_CUSTO_FIXO), meses);

  const totalReceitas = somar("Receitas", receitas, n);
  const totalCustosVariaveis = somar("Custos variáveis", custosVariaveis, n);
  const margemContribuicao = subtrair("Margem de contribuição", totalReceitas, totalCustosVariaveis);
  const custosFixos = somar("Custos fixos", fixos, n);
  const resultado = subtrair("Resultado", margemContribuicao, custosFixos);

  return { meses, receitas, totalReceitas, custosVariaveis, totalCustosVariaveis, margemContribuicao, custosFixos, resultado };
}
