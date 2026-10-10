// Central de pendências (sino da barra superior) — regras PURAS: recebem os
// dados já carregados e devolvem a lista de alertas. Quem busca os dados e
// decide quais módulos o usuário enxerga é lib/contexts/alertas.ts.

import type { Modulo } from "./acesso";
import { formatarMoeda } from "./format";

export type SeveridadeAlerta = "critico" | "atencao";

export interface Alerta {
  id: string;
  modulo: Modulo;
  severidade: SeveridadeAlerta;
  titulo: string;
  /** Linha de apoio: valores, nomes, datas. */
  detalhe: string;
  /** Tela onde a pendência se resolve. */
  href: string;
}

export interface ConfigAlertas {
  dias_contas_a_vencer: number;
  dias_documentos_a_vencer: number;
}

export const CONFIG_ALERTAS_PADRAO: ConfigAlertas = { dias_contas_a_vencer: 7, dias_documentos_a_vencer: 30 };

/** Dias inteiros entre duas datas YYYY-MM-DD (positivo = `ate` no futuro). */
export function diasEntre(de: string, ate: string): number {
  const ms = Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

const plural = (n: number, singular: string, pluralizado: string) => `${n} ${n === 1 ? singular : pluralizado}`;

/** "Fulano, Beltrano e mais 3" — até `limite` nomes por extenso. */
function resumirNomes(nomes: string[], limite = 3): string {
  const unicos = [...new Set(nomes)];
  if (unicos.length <= limite) return unicos.join(", ");
  return `${unicos.slice(0, limite).join(", ")} e mais ${unicos.length - limite}`;
}

// --- Validade de documento (também usada pelas telas do RH) -------------------

export type SituacaoValidade = "sem_validade" | "vencido" | "vencendo" | "em_dia";

export function situacaoValidade(validade: string | null | undefined, hoje: string, diasAviso: number): SituacaoValidade {
  if (!validade) return "sem_validade";
  const dias = diasEntre(hoje, validade);
  if (dias < 0) return "vencido";
  if (dias <= diasAviso) return "vencendo";
  return "em_dia";
}

// --- Financeiro --------------------------------------------------------------

export interface ContaEmAberto {
  tipo: "receita" | "despesa";
  valor: number;
  /** Vencimento (YYYY-MM-DD). */
  data: string;
}

export function alertasFinanceiros(contas: ContaEmAberto[], hoje: string, diasAviso: number): Alerta[] {
  const alertas: Alerta[] = [];
  const grupo = (tipo: ContaEmAberto["tipo"], vencidas: boolean) =>
    contas.filter((c) => {
      if (c.tipo !== tipo) return false;
      const dias = diasEntre(hoje, c.data);
      return vencidas ? dias < 0 : dias >= 0 && dias <= diasAviso;
    });
  const total = (lista: ContaEmAberto[]) => formatarMoeda(lista.reduce((soma, c) => soma + c.valor, 0));
  const prazo = diasAviso === 0 ? "hoje" : `nos próximos ${plural(diasAviso, "dia", "dias")}`;

  const pagarVencidas = grupo("despesa", true);
  if (pagarVencidas.length > 0) {
    alertas.push({
      id: "contas-a-pagar-vencidas",
      modulo: "financeiro",
      severidade: "critico",
      titulo: `${plural(pagarVencidas.length, "conta a pagar vencida", "contas a pagar vencidas")}`,
      detalhe: `Total de ${total(pagarVencidas)}.`,
      href: "/financeiro/lancamentos",
    });
  }

  const receberVencidas = grupo("receita", true);
  if (receberVencidas.length > 0) {
    alertas.push({
      id: "contas-a-receber-vencidas",
      modulo: "financeiro",
      severidade: "critico",
      titulo: `${plural(receberVencidas.length, "recebimento atrasado", "recebimentos atrasados")}`,
      detalhe: `Total de ${total(receberVencidas)}.`,
      href: "/financeiro/lancamentos",
    });
  }

  const pagarVencendo = grupo("despesa", false);
  if (pagarVencendo.length > 0) {
    alertas.push({
      id: "contas-a-pagar-vencendo",
      modulo: "financeiro",
      severidade: "atencao",
      titulo: `${plural(pagarVencendo.length, "conta a pagar vence", "contas a pagar vencem")} ${prazo}`,
      detalhe: `Total de ${total(pagarVencendo)}.`,
      href: "/financeiro/lancamentos",
    });
  }

  const receberVencendo = grupo("receita", false);
  if (receberVencendo.length > 0) {
    alertas.push({
      id: "contas-a-receber-vencendo",
      modulo: "financeiro",
      severidade: "atencao",
      titulo: `${plural(receberVencendo.length, "recebimento previsto", "recebimentos previstos")} ${prazo}`,
      detalhe: `Total de ${total(receberVencendo)}.`,
      href: "/financeiro/lancamentos",
    });
  }

  return alertas;
}

// --- RH: documentos ------------------------------------------------------------

export interface DocumentoComValidade {
  nome: string;
  validade: string | null;
  /** Nome do funcionário dono do documento; `null` = documento da empresa. */
  funcionario: string | null;
}

export function alertasDocumentos(documentos: DocumentoComValidade[], hoje: string, diasAviso: number): Alerta[] {
  const alertas: Alerta[] = [];
  const rotulo = (d: DocumentoComValidade) => (d.funcionario ? `${d.nome} (${d.funcionario})` : d.nome);

  for (const [origem, href] of [
    ["funcionario", "/rh/funcionarios"],
    ["empresa", "/rh"],
  ] as const) {
    const daOrigem = documentos.filter((d) => (origem === "funcionario" ? d.funcionario !== null : d.funcionario === null));
    const dono = origem === "funcionario" ? "de funcionários" : "da empresa";

    const vencidos = daOrigem.filter((d) => situacaoValidade(d.validade, hoje, diasAviso) === "vencido");
    if (vencidos.length > 0) {
      alertas.push({
        id: `documentos-${origem}-vencidos`,
        modulo: "rh",
        severidade: "critico",
        titulo: `${plural(vencidos.length, "documento", "documentos")} ${dono} ${vencidos.length === 1 ? "vencido" : "vencidos"}`,
        detalhe: `${resumirNomes(vencidos.map(rotulo))}.`,
        href,
      });
    }

    const vencendo = daOrigem.filter((d) => situacaoValidade(d.validade, hoje, diasAviso) === "vencendo");
    if (vencendo.length > 0) {
      alertas.push({
        id: `documentos-${origem}-vencendo`,
        modulo: "rh",
        severidade: "atencao",
        titulo: `${plural(vencendo.length, "documento", "documentos")} ${dono} ${vencendo.length === 1 ? "vence" : "vencem"} em até ${plural(diasAviso, "dia", "dias")}`,
        detalhe: `${resumirNomes(vencendo.map(rotulo))}.`,
        href,
      });
    }
  }

  return alertas;
}

// --- Operacional: obras --------------------------------------------------------

export interface ObraParaAlerta {
  id: string;
  numero: string;
  cliente: string | null;
  etapa: "planejamento" | "execucao" | "finalizado";
  data_fim_prevista: string | null;
  orcado: number;
  receita: number;
  despesa: number;
}

export function alertasObras(obras: ObraParaAlerta[], hoje: string): Alerta[] {
  const alertas: Alerta[] = [];
  const nome = (o: ObraParaAlerta) => (o.cliente ? `${o.numero} (${o.cliente})` : o.numero);
  const href = "/operacional/servicos";

  const atrasadas = obras.filter((o) => o.etapa !== "finalizado" && o.data_fim_prevista && o.data_fim_prevista.slice(0, 10) < hoje);
  if (atrasadas.length > 0) {
    alertas.push({
      id: "obras-prazo-vencido",
      modulo: "operacional",
      severidade: "critico",
      titulo: `${plural(atrasadas.length, "obra passou", "obras passaram")} do término previsto`,
      detalhe: `${resumirNomes(atrasadas.map(nome))}.`,
      href,
    });
  }

  const acimaDoOrcado = obras.filter((o) => o.orcado > 0 && o.despesa > o.orcado);
  if (acimaDoOrcado.length > 0) {
    alertas.push({
      id: "obras-despesa-acima-orcado",
      modulo: "operacional",
      severidade: "atencao",
      titulo: `${plural(acimaDoOrcado.length, "obra", "obras")} com despesa acima do orçado`,
      detalhe: `${resumirNomes(acimaDoOrcado.map((o) => `${nome(o)}: ${formatarMoeda(o.despesa)} de ${formatarMoeda(o.orcado)}`), 2)}.`,
      href,
    });
  }

  const semReceita = obras.filter((o) => o.etapa === "finalizado" && o.receita === 0);
  if (semReceita.length > 0) {
    alertas.push({
      id: "obras-finalizadas-sem-receita",
      modulo: "operacional",
      severidade: "atencao",
      titulo: `${plural(semReceita.length, "obra finalizada", "obras finalizadas")} sem receita lançada`,
      detalhe: `${resumirNomes(semReceita.map(nome))}.`,
      href,
    });
  }

  return alertas;
}

// --- Operacional: documentação de parceiros ------------------------------------

export function alertasDocumentosDeParceiros(
  documentos: Array<{ parceiro: string; nome: string; validade: string }>,
  hoje: string,
  diasAviso: number
): Alerta[] {
  const alertas: Alerta[] = [];
  const rotulo = (d: { parceiro: string; nome: string }) => `${d.nome} (${d.parceiro})`;
  const href = "/operacional/parceiros";

  const vencidos = documentos.filter((d) => situacaoValidade(d.validade, hoje, diasAviso) === "vencido");
  if (vencidos.length > 0) {
    alertas.push({
      id: "documentos-parceiro-vencidos",
      modulo: "operacional",
      severidade: "critico",
      titulo: `${plural(vencidos.length, "documento", "documentos")} de parceiros ${vencidos.length === 1 ? "vencido" : "vencidos"}`,
      detalhe: `${resumirNomes(vencidos.map(rotulo))}.`,
      href,
    });
  }

  const vencendo = documentos.filter((d) => situacaoValidade(d.validade, hoje, diasAviso) === "vencendo");
  if (vencendo.length > 0) {
    alertas.push({
      id: "documentos-parceiro-vencendo",
      modulo: "operacional",
      severidade: "atencao",
      titulo: `${plural(vencendo.length, "documento", "documentos")} de parceiros ${vencendo.length === 1 ? "vence" : "vencem"} em até ${plural(diasAviso, "dia", "dias")}`,
      detalhe: `${resumirNomes(vencendo.map(rotulo))}.`,
      href,
    });
  }

  return alertas;
}

/** Críticos primeiro; dentro de cada severidade, na ordem em que chegaram. */
export function ordenarAlertas(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort((a, b) => Number(b.severidade === "critico") - Number(a.severidade === "critico"));
}
