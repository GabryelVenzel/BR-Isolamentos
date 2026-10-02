import { ValidationError } from "../../errors";
import type { Periodo } from "../../types/resumo";

export interface IntervaloData {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  label: string;
}

// Bug relatado (achado ao testar a linha "Semana"): `new Date().toISOString()`
// converte pra UTC — depois das ~21h de Brasília (UTC-3), isso já é o DIA
// SEGUINTE em UTC, então "hoje"/início de mês/início de semana saíam
// adiantados em 1 dia bem no fim do dia. `new Date("2026-08-01")` tem o
// problema espelhado: strings "YYYY-MM-DD" são interpretadas como meia-noite
// UTC, e ler de volta com getters LOCAIS (`getDate()`) podia voltar um dia.
// Correção: tudo aqui é construído/lido em UTC (Date.UTC + getUTC*) como uma
// representação "pura" de calendário (sem hora/fuso) — e o ponto de partida
// ("hoje") vem explicitamente do fuso de Brasília via Intl.DateTimeFormat,
// independente do fuso do servidor (a Vercel roda em UTC). Mesmo truque de
// lib/usecases/financeiro/marcarCustoFixoPago.ts#obterDataHojeBrasilia.
function hojeBrasilia(): Date {
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .split("-")
    .map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function paraISO(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Parseia "YYYY-MM-DD" como data "pura" em UTC — ver nota acima sobre por
 * que não usar o construtor `Date` direto nem getters locais. */
function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somarDias(data: Date, n: number): Date {
  const d = new Date(data);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Segunda-feira da semana de `data` (convenção semana comercial, segunda a
 * domingo). `getUTCDay()`: 0=domingo..6=sábado — domingo é tratado como "fim"
 * da semana anterior, não início da semana corrente. */
function inicioDaSemana(data: Date): Date {
  const diaSemana = data.getUTCDay();
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  return somarDias(data, deslocamento);
}

/** Resolve o seletor de período da FilterBar num intervalo de datas concreto
 * (`dataInicio`/`dataFim`, ambas inclusivas) + o rótulo usado nos títulos dos
 * KPIs (ex.: "RECEITA DO MÊS" quando periodo="mes_atual"). Central pra não
 * duplicar essa lógica em cada rota de app/api/resumo (e, desde a
 * padronização entre as 4 abas do Resumo, também em app/api/comercial/
 * relatorios, app/api/operacional/relatorios e app/api/financeiro/relatorios).
 *
 * Os 6 períodos "de linha" (Semana/Mês/Ano × Atual/Anterior) são FECHADOS e
 * alinhados ao calendário — pedido explícito, pra comparar período fechado
 * com período fechado (mês inteiro vs mês inteiro, não "30 dias corridos" vs
 * "o mês passado"). "Atual" vai até HOJE (não dá pra ter dado do futuro);
 * "anterior" é sempre o período fechado completo imediatamente anterior. */
export function resolverPeriodo(
  periodo: Periodo,
  dataInicioCustom?: string,
  dataFimCustom?: string
): IntervaloData {
  const hoje = hojeBrasilia();

  switch (periodo) {
    case "semana_atual": {
      return { dataInicio: paraISO(inicioDaSemana(hoje)), dataFim: paraISO(hoje), label: "Semana atual" };
    }
    case "semana_anterior": {
      const inicioSemanaAtual = inicioDaSemana(hoje);
      const fim = somarDias(inicioSemanaAtual, -1);
      const inicio = somarDias(fim, -6);
      return { dataInicio: paraISO(inicio), dataFim: paraISO(fim), label: "Semana anterior" };
    }
    case "mes_anterior": {
      const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1));
      const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0)); // dia 0 = último dia do mês anterior
      return { dataInicio: paraISO(inicio), dataFim: paraISO(fim), label: "Mês anterior" };
    }
    case "ano_atual": {
      return { dataInicio: `${hoje.getUTCFullYear()}-01-01`, dataFim: paraISO(hoje), label: "Ano atual" };
    }
    case "ano_anterior": {
      const anoAnterior = hoje.getUTCFullYear() - 1;
      return { dataInicio: `${anoAnterior}-01-01`, dataFim: `${anoAnterior}-12-31`, label: "Ano anterior" };
    }
    case "custom": {
      if (!dataInicioCustom || !dataFimCustom) {
        throw new ValidationError("Período customizado exige dataInicio e dataFim.");
      }
      return { dataInicio: dataInicioCustom, dataFim: dataFimCustom, label: "Período selecionado" };
    }
    case "mes_atual":
    default: {
      const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
      return { dataInicio: paraISO(inicio), dataFim: paraISO(hoje), label: "Mês atual" };
    }
  }
}

/** Intervalo imediatamente anterior ao informado, com a mesma duração em
 * dias — usado pra calcular tendência ("vs período anterior") de forma
 * consistente pra qualquer período escolhido (não só "mês"). */
export function periodoAnterior(intervalo: IntervaloData): IntervaloData {
  const inicio = paraData(intervalo.dataInicio);
  const fim = paraData(intervalo.dataFim);
  const duracaoDias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1);

  const novoFim = somarDias(inicio, -1);
  const novoInicio = somarDias(novoFim, -(duracaoDias - 1));

  return { dataInicio: paraISO(novoInicio), dataFim: paraISO(novoFim), label: "Período anterior" };
}

/** Variação percentual de `atual` em relação a `anterior`. `null` quando não
 * dá pra calcular (`anterior` é zero) — o card mostra "—" nesse caso em vez
 * de uma porcentagem sem sentido (ex.: crescimento "infinito" de 0 pra 100). */
export function calcularTendencia(atual: number, anterior: number): { percentual: number | null; cor: "positiva" | "negativa" | "neutra" } {
  if (anterior === 0) {
    return { percentual: null, cor: atual > 0 ? "positiva" : "neutra" };
  }
  const percentual = ((atual - anterior) / Math.abs(anterior)) * 100;
  const cor = percentual > 0.5 ? "positiva" : percentual < -0.5 ? "negativa" : "neutra";
  return { percentual, cor };
}
