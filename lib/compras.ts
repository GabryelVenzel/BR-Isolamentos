// Regras PURAS de compras e diárias (migração 044): totais, comparação de
// cotação, histórico de preços e lista de compras a partir do orçamento.

import type { CotacaoItem, CotacaoProposta, Diaria, PeriodoDiaria, StatusPedidoCompra } from "./types/domain";

export const LABEL_STATUS_PEDIDO: Record<StatusPedidoCompra, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

export const PERIODOS_DIARIA: PeriodoDiaria[] = ["integral", "manha", "tarde", "noite"];

export const LABEL_PERIODO_DIARIA: Record<PeriodoDiaria, string> = {
  integral: "Dia inteiro",
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export const UNIDADES_COMPRA = ["un", "m²", "m", "kg", "rolo", "caixa", "frasco", "peça", "litro", "cento"] as const;

const arredondar = (valor: number) => Math.round(valor * 100) / 100;

// --- Pedido -------------------------------------------------------------------

export interface ItemComPreco {
  quantidade: number;
  preco_unitario: number;
}

export function totalItem(item: ItemComPreco): number {
  return arredondar(item.quantidade * item.preco_unitario);
}

export function totalPedido(itens: ItemComPreco[]): number {
  return arredondar(itens.reduce((soma, item) => soma + item.quantidade * item.preco_unitario, 0));
}

// --- Cotação ------------------------------------------------------------------

export interface PropostaComparada {
  propostaId: string;
  fornecedorId: string;
  fornecedor: string;
  /** Soma de quantidade × preço dos itens que o fornecedor cotou. */
  total: number;
  /** Quantos itens da cotação ficaram sem preço nesta proposta. */
  itensSemPreco: number;
  /** Cotou todos os itens — só propostas completas disputam o menor total. */
  completa: boolean;
}

export interface ComparacaoCotacao {
  propostas: PropostaComparada[];
  /** Por item: id da proposta com o menor preço unitário (entre as que cotaram). */
  menorPrecoPorItem: Record<string, string>;
  /** Proposta completa de menor total; `null` se nenhuma cotou tudo. */
  melhorPropostaId: string | null;
}

export function compararCotacao(itens: CotacaoItem[], propostas: CotacaoProposta[]): ComparacaoCotacao {
  const preco = (p: CotacaoProposta, itemId: string) => {
    const valor = p.precos?.[itemId];
    return typeof valor === "number" && valor > 0 ? valor : null;
  };

  const comparadas: PropostaComparada[] = propostas.map((p) => {
    let total = 0;
    let itensSemPreco = 0;
    for (const item of itens) {
      const unitario = preco(p, item.id);
      if (unitario === null) itensSemPreco++;
      else total += unitario * item.quantidade;
    }
    return {
      propostaId: p.id,
      fornecedorId: p.fornecedor_id,
      fornecedor: p.fornecedor?.nome ?? "Fornecedor",
      total: arredondar(total),
      itensSemPreco,
      completa: itens.length > 0 && itensSemPreco === 0,
    };
  });

  const menorPrecoPorItem: Record<string, string> = {};
  for (const item of itens) {
    let melhor: { propostaId: string; valor: number } | null = null;
    for (const p of propostas) {
      const unitario = preco(p, item.id);
      if (unitario !== null && (!melhor || unitario < melhor.valor)) melhor = { propostaId: p.id, valor: unitario };
    }
    if (melhor) menorPrecoPorItem[item.id] = melhor.propostaId;
  }

  const completas = comparadas.filter((p) => p.completa).sort((a, b) => a.total - b.total);
  return { propostas: comparadas, menorPrecoPorItem, melhorPropostaId: completas[0]?.propostaId ?? null };
}

// --- Histórico de preços -------------------------------------------------------

export interface CompraDeItem {
  descricao: string;
  unidade: string;
  preco_unitario: number;
  quantidade: number;
  data: string;
  pedido: string;
  fornecedorId: string;
  fornecedor: string;
  preco_config_id: number | null;
}

export interface HistoricoDeItem {
  descricao: string;
  unidade: string;
  /** Compras da mais recente para a mais antiga. */
  compras: CompraDeItem[];
  ultimoPreco: number;
  menorPreco: number;
  maiorPreco: number;
  precoMedio: number;
  /** Variação da última compra em relação à anterior (%); `null` com uma compra só. */
  variacaoPercentual: number | null;
  /** Item do catálogo de preços ligado à compra mais recente que tiver um. */
  preco_config_id: number | null;
}

const chaveDoItem = (descricao: string, unidade: string) => `${descricao.trim().toLowerCase().replace(/\s+/g, " ")}|${unidade.trim().toLowerCase()}`;

/** Agrupa as compras pelo mesmo item (descrição + unidade, ignorando
 * maiúsculas e espaços) e resume a evolução do preço. */
export function historicoDePrecos(compras: CompraDeItem[]): HistoricoDeItem[] {
  const grupos = new Map<string, CompraDeItem[]>();
  for (const compra of compras) {
    if (compra.preco_unitario <= 0) continue;
    const chave = chaveDoItem(compra.descricao, compra.unidade);
    grupos.set(chave, [...(grupos.get(chave) ?? []), compra]);
  }

  return [...grupos.values()]
    .map((grupo) => {
      const ordenadas = [...grupo].sort((a, b) => b.data.localeCompare(a.data));
      const precos = ordenadas.map((c) => c.preco_unitario);
      const [ultima, anterior] = ordenadas;
      return {
        descricao: ultima.descricao,
        unidade: ultima.unidade,
        compras: ordenadas,
        ultimoPreco: ultima.preco_unitario,
        menorPreco: Math.min(...precos),
        maiorPreco: Math.max(...precos),
        precoMedio: arredondar(precos.reduce((s, p) => s + p, 0) / precos.length),
        variacaoPercentual: anterior ? ((ultima.preco_unitario - anterior.preco_unitario) / anterior.preco_unitario) * 100 : null,
        preco_config_id: ordenadas.find((c) => c.preco_config_id !== null)?.preco_config_id ?? null,
      };
    })
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
}

// --- Lista de compras da obra --------------------------------------------------

export interface MaterialQuantificado {
  isolante: string;
  acabamento: string;
  isolanteM2: number;
  acabamentoM2: number;
  rebiteUn: number;
  parafusoUn: number;
  arameMetros: number;
  siliconeFrascos: number;
}

export interface ItemListaCompras {
  descricao: string;
  unidade: string;
  quantidade: number;
}

/** Soma os materiais quantificados de todos os trechos do orçamento da obra
 * numa lista única, agrupando o que for o mesmo material. `multiplicador`
 * escala a lista inteira — para orçamento feito por metro ou por unidade
 * (ex.: orçado 1 metro, fechados 100). */
export function listaDeCompras(trechos: MaterialQuantificado[], multiplicador = 1): ItemListaCompras[] {
  const mapa = new Map<string, ItemListaCompras>();
  const somar = (descricao: string, unidade: string, quantidade: number) => {
    if (!descricao.trim() || quantidade <= 0) return;
    const chave = chaveDoItem(descricao, unidade);
    const atual = mapa.get(chave);
    if (atual) atual.quantidade += quantidade;
    else mapa.set(chave, { descricao: descricao.trim(), unidade, quantidade });
  };

  for (const t of trechos) {
    somar(t.isolante, "m²", t.isolanteM2);
    somar(t.acabamento, "m²", t.acabamentoM2);
    somar("Rebite", "un", t.rebiteUn);
    somar("Parafuso", "un", t.parafusoUn);
    somar("Arame", "m", t.arameMetros);
    somar("Silicone", "frasco", t.siliconeFrascos);
  }

  const inteiras = new Set(["un", "frasco"]);
  return [...mapa.values()].map((item) => {
    const escalada = item.quantidade * multiplicador;
    // Peças inteiras arredondam pra cima: não se compra meio rebite.
    return { ...item, quantidade: inteiras.has(item.unidade) ? Math.ceil(escalada - 1e-9) : arredondar(escalada) };
  });
}

// --- Diárias -------------------------------------------------------------------

export interface ResumoDiarias {
  total: number;
  /** Soma de pessoas × apontamentos (cada apontamento conta suas pessoas). */
  pessoasDia: number;
  /** Uma linha por quem trabalhou — parceiro ou funcionário da equipe própria. */
  porParceiro: Array<{ parceiroId: string; parceiro: string; proprio: boolean; apontamentos: number; pessoasDia: number; valor: number }>;
}

export function resumirDiarias(
  diarias: Array<Pick<Diaria, "parceiro_id" | "pessoas" | "valor" | "parceiro"> & Partial<Pick<Diaria, "funcionario_id" | "funcionario">>>
): ResumoDiarias {
  const mapa = new Map<string, ResumoDiarias["porParceiro"][number]>();
  let total = 0;
  let pessoasDia = 0;
  for (const d of diarias) {
    total += d.valor;
    pessoasDia += d.pessoas;
    const proprio = !d.parceiro_id;
    const chave = proprio ? `f:${d.funcionario_id}` : `p:${d.parceiro_id}`;
    const nome = proprio ? d.funcionario?.nome ?? "Funcionário" : d.parceiro?.nome ?? "Parceiro";
    const atual = mapa.get(chave) ?? { parceiroId: chave, parceiro: nome, proprio, apontamentos: 0, pessoasDia: 0, valor: 0 };
    atual.apontamentos++;
    atual.pessoasDia += d.pessoas;
    atual.valor += d.valor;
    mapa.set(chave, atual);
  }
  return {
    total: arredondar(total),
    pessoasDia,
    porParceiro: [...mapa.values()].map((p) => ({ ...p, valor: arredondar(p.valor) })).sort((a, b) => b.valor - a.valor),
  };
}
