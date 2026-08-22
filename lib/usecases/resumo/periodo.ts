import { ValidationError } from "../../errors";
import type { Periodo } from "../../types/resumo";

export interface IntervaloData {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  label: string;
}

function paraISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Resolve o seletor de período da FilterBar num intervalo de datas concreto
 * (`dataInicio`/`dataFim`, ambas inclusivas) + o rótulo usado nos títulos dos
 * KPIs (ex.: "RECEITA DO MÊS" quando periodo="mes", "RECEITA DO PERÍODO" nos
 * demais). Central pra não duplicar essa lógica em cada rota de app/api/resumo. */
export function resolverPeriodo(
  periodo: Periodo,
  dataInicioCustom?: string,
  dataFimCustom?: string
): IntervaloData {
  const hoje = new Date();

  switch (periodo) {
    case "7d":
      return { dataInicio: paraISO(diasAtras(6)), dataFim: paraISO(hoje), label: "Últimos 7 dias" };
    case "30d":
      return { dataInicio: paraISO(diasAtras(29)), dataFim: paraISO(hoje), label: "Últimos 30 dias" };
    case "90d":
      return { dataInicio: paraISO(diasAtras(89)), dataFim: paraISO(hoje), label: "Últimos 90 dias" };
    case "ano":
      return { dataInicio: `${hoje.getFullYear()}-01-01`, dataFim: paraISO(hoje), label: "Este ano" };
    case "tudo":
      return { dataInicio: "2000-01-01", dataFim: paraISO(hoje), label: "Todo período" };
    case "custom": {
      if (!dataInicioCustom || !dataFimCustom) {
        throw new ValidationError("Período customizado exige dataInicio e dataFim.");
      }
      return { dataInicio: dataInicioCustom, dataFim: dataFimCustom, label: "Período selecionado" };
    }
    case "mes":
    default: {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { dataInicio: paraISO(inicioMes), dataFim: paraISO(hoje), label: "Este mês" };
    }
  }
}

/** Intervalo imediatamente anterior ao informado, com a mesma duração em
 * dias — usado pra calcular tendência ("vs período anterior") de forma
 * consistente pra qualquer período escolhido (não só "mês"). */
export function periodoAnterior(intervalo: IntervaloData): IntervaloData {
  const inicio = new Date(intervalo.dataInicio);
  const fim = new Date(intervalo.dataFim);
  const duracaoDias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1);

  const novoFim = new Date(inicio);
  novoFim.setDate(novoFim.getDate() - 1);
  const novoInicio = new Date(novoFim);
  novoInicio.setDate(novoInicio.getDate() - (duracaoDias - 1));

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
