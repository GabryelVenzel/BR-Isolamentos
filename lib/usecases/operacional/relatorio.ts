import type { EtapaServico, Servico } from "../../types/domain";

// Relatório da aba "Relatórios" do Operacional — funções puras (sem I/O),
// mesmo espírito de lib/usecases/comercial/relatorio.ts.

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const LABELS_ETAPA: Record<EtapaServico, string> = {
  planejamento: "Planejamento",
  execucao: "Execução",
  finalizado: "Finalizado",
};

export interface KpisOperacional {
  servicosConcluidos: number;
  servicosEmProgresso: number;
  servicosPlanejados: number;
  taxaConclusaoPercentual: number;
  tempoMedioExecucaoDias: number;
  custoRealVsOrcadoPercentual: number | null;
}

/** `dataInicio`/`fimReal` de um serviço finalizado definem sua "duração de
 * execução" — usa `data_inicio` até `data_fim_real` (não `data_fim_prevista`,
 * que é só a estimativa). Serviços finalizados sem as duas datas ficam de
 * fora da média (não dá pra calcular duração sem elas). */
export function calcularKpis(servicos: Servico[]): KpisOperacional {
  const concluidos = servicos.filter((s) => s.etapa === "finalizado");
  const emProgresso = servicos.filter((s) => s.etapa === "execucao");
  const planejados = servicos.filter((s) => s.etapa === "planejamento");

  const duracoes = concluidos
    .filter((s) => s.data_inicio && s.data_fim_real)
    .map((s) => (new Date(s.data_fim_real as string).getTime() - new Date(s.data_inicio as string).getTime()) / UM_DIA_MS)
    .filter((dias) => dias >= 0);
  const tempoMedioExecucaoDias = duracoes.length > 0 ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : 0;

  const comValorReal = concluidos.filter((s) => s.valor_orcado != null && s.valor_real != null && s.valor_orcado > 0);
  const totalOrcado = comValorReal.reduce((soma, s) => soma + (s.valor_orcado ?? 0), 0);
  const totalReal = comValorReal.reduce((soma, s) => soma + (s.valor_real ?? 0), 0);

  return {
    servicosConcluidos: concluidos.length,
    servicosEmProgresso: emProgresso.length,
    servicosPlanejados: planejados.length,
    taxaConclusaoPercentual: servicos.length > 0 ? (concluidos.length / servicos.length) * 100 : 0,
    tempoMedioExecucaoDias,
    custoRealVsOrcadoPercentual: totalOrcado > 0 ? (totalReal / totalOrcado) * 100 : null,
  };
}

export interface EtapaFunilServico {
  etapa: EtapaServico;
  label: string;
  quantidade: number;
  retencaoPercentual: number | null;
}

/** Funil simples (snapshot da etapa atual, não cumulativo — diferente do
 * funil de leads do Comercial, aqui não há necessidade de reconstruir
 * histórico: só 3 etapas lineares e o interesse é "quantos estão em cada
 * uma agora", igual ao snapshot do dashboard Resumo). */
export function calcularFunilServicos(servicos: Servico[]): EtapaFunilServico[] {
  const ordem: EtapaServico[] = ["planejamento", "execucao", "finalizado"];
  return ordem.map((etapa, index) => {
    const quantidade = servicos.filter((s) => s.etapa === etapa).length;
    let retencaoPercentual: number | null = null;
    if (index > 0) {
      const anteriorQtd = servicos.filter((s) => s.etapa === ordem[index - 1]).length;
      retencaoPercentual = anteriorQtd > 0 ? (quantidade / anteriorQtd) * 100 : 0;
    }
    return { etapa, label: LABELS_ETAPA[etapa], quantidade, retencaoPercentual };
  });
}

export interface TempoExecucaoPorTipo {
  tipoTrabalho: string;
  diasRealizado: number;
  diasOrcado: number | null;
}

/** "Dias orçado" aqui é uma aproximação: a diferença entre
 * `data_fim_prevista` e `data_inicio` no momento da criação do serviço (o
 * prazo planejado), não um campo financeiro separado — não existe uma coluna
 * "prazo orçado em dias" no schema, então usamos a janela planejada como
 * proxy. */
export function calcularTempoExecucaoPorTipo(servicos: Servico[]): TempoExecucaoPorTipo[] {
  const concluidos = servicos.filter((s) => s.etapa === "finalizado" && s.tipo_trabalho && s.data_inicio && s.data_fim_real);
  const porTipo = new Map<string, Servico[]>();
  for (const s of concluidos) {
    const tipo = s.tipo_trabalho as string;
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), s]);
  }

  return Array.from(porTipo.entries()).map(([tipoTrabalho, lista]) => {
    const diasRealizados = lista.map(
      (s) => (new Date(s.data_fim_real as string).getTime() - new Date(s.data_inicio as string).getTime()) / UM_DIA_MS
    );
    const diasOrcados = lista
      .filter((s) => s.data_fim_prevista)
      .map((s) => (new Date(s.data_fim_prevista as string).getTime() - new Date(s.data_inicio as string).getTime()) / UM_DIA_MS);

    return {
      tipoTrabalho,
      diasRealizado: diasRealizados.reduce((a, b) => a + b, 0) / diasRealizados.length,
      diasOrcado: diasOrcados.length > 0 ? diasOrcados.reduce((a, b) => a + b, 0) / diasOrcados.length : null,
    };
  });
}

export interface CustoRealVsOrcado {
  totalOrcado: number;
  totalReal: number;
  variancePercentual: number | null;
  porTipo: Array<{ tipoTrabalho: string; orcado: number; real: number }>;
}

export function calcularCustoRealVsOrcado(servicos: Servico[]): CustoRealVsOrcado {
  const comValores = servicos.filter((s) => s.etapa === "finalizado" && s.valor_orcado != null && s.valor_real != null);

  const totalOrcado = comValores.reduce((soma, s) => soma + (s.valor_orcado ?? 0), 0);
  const totalReal = comValores.reduce((soma, s) => soma + (s.valor_real ?? 0), 0);

  const porTipoMap = new Map<string, { orcado: number; real: number }>();
  for (const s of comValores) {
    const tipo = s.tipo_trabalho ?? "Não informado";
    const atual = porTipoMap.get(tipo) ?? { orcado: 0, real: 0 };
    atual.orcado += s.valor_orcado ?? 0;
    atual.real += s.valor_real ?? 0;
    porTipoMap.set(tipo, atual);
  }

  return {
    totalOrcado,
    totalReal,
    variancePercentual: totalOrcado > 0 ? ((totalReal - totalOrcado) / totalOrcado) * 100 : null,
    porTipo: Array.from(porTipoMap.entries()).map(([tipoTrabalho, v]) => ({ tipoTrabalho, ...v })),
  };
}

/** Serviços "vencidos": ainda não finalizados, mas com `data_fim_prevista`
 * no passado. `diasAtraso` é sempre >= 1 (arredondado pra cima). */
export function calcularServicosVencidos(servicos: Servico[], agora: Date = new Date()): Array<{ servico: Servico; diasAtraso: number }> {
  return servicos
    .filter((s) => s.etapa !== "finalizado" && s.data_fim_prevista && new Date(s.data_fim_prevista) < agora)
    .map((s) => ({
      servico: s,
      diasAtraso: Math.ceil((agora.getTime() - new Date(s.data_fim_prevista as string).getTime()) / UM_DIA_MS),
    }))
    .sort((a, b) => b.diasAtraso - a.diasAtraso);
}

export interface RelatorioOperacional {
  kpis: KpisOperacional;
  funil: EtapaFunilServico[];
  tempoExecucaoPorTipo: TempoExecucaoPorTipo[];
  custoRealVsOrcado: CustoRealVsOrcado;
  servicosVencidos: Array<{ servico: Servico; diasAtraso: number }>;
}

export function gerarRelatorioOperacional(servicos: Servico[], agora: Date = new Date()): RelatorioOperacional {
  return {
    kpis: calcularKpis(servicos),
    funil: calcularFunilServicos(servicos),
    tempoExecucaoPorTipo: calcularTempoExecucaoPorTipo(servicos),
    custoRealVsOrcado: calcularCustoRealVsOrcado(servicos),
    servicosVencidos: calcularServicosVencidos(servicos, agora),
  };
}
