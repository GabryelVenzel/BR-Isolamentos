// Cálculos de apoio às Propostas Técnica/Comercial (payback, projeção de
// economia, equivalência ambiental, prazo de execução) — puros, sem I/O,
// compartilhados entre o gerador de PDF (components/pdf-native/*) e o de
// Word (lib/docx-generator.ts) para as duas versões nunca divergirem.
//
// Nenhum número de política comercial (reajuste tarifário assumido, fator de
// CO₂ por árvore) é fixo aqui — sempre recebido como parâmetro
// (ConfigEmpresa), ver decisão 2 em sql-migration-020-detalhamento-propostas.sql.

import type { ItemOrcamento, Orcamento, TipoTrabalho } from "../../types";
import { LABEL_FUNCAO_MAO_OBRA } from "./maoObraEquipe";
import { metragemFinalItem, quantidadeEscopoItem } from "./escopo";

export interface BeneficiosConsolidados {
  economiaAnualTotal: number;
  co2ToneladasAno: number;
}

/** Soma a economia anual e o CO₂ evitado de todos os trechos com resultado
 * financeiro (só trechos "quente" com `calcular_financeiro` preenchem esses
 * campos — ver lib/calculadora-termica.ts). */
export function calcularBeneficiosConsolidados(itens: ItemOrcamento[]): BeneficiosConsolidados {
  return {
    economiaAnualTotal: Number(itens.reduce((acc, i) => acc + (i.economia_anual ?? 0), 0).toFixed(2)),
    co2ToneladasAno: Number(itens.reduce((acc, i) => acc + (i.co2_ton_ano ?? 0), 0).toFixed(3)),
  };
}

/** Payback em meses para proposta "Material + Mão de Obra": tempo para a
 * economia anual pagar o valor total investido. `null` quando não há
 * economia estimada (ex.: orçamento só de trechos frios, ou sem cálculo
 * financeiro habilitado) — nesse caso a proposta não deve exibir a caixa de
 * payback, exibir "0" ou "Infinity" seria enganoso. */
export function calcularPaybackMeses(valorFinal: number, economiaAnualTotal: number): number | null {
  if (economiaAnualTotal <= 0) return null;
  return Number(((valorFinal / economiaAnualTotal) * 12).toFixed(1));
}

/** Payback em dias para proposta "Somente Mão de Obra" — o material já foi
 * fornecido pelo cliente, então o "investimento" relevante pro payback é só
 * o valor da mão de obra (`valorFinal`, que em somente_mo já reflete isso —
 * ver lib/orcamento.ts). Tende a ser bem mais rápido, por isso em dias em
 * vez de meses (ver Parte 2 do pedido "COMPLEMENTO: PROPOSTAS DIFERENCIADAS"). */
export function calcularPaybackDias(valorFinal: number, economiaAnualTotal: number): number | null {
  if (economiaAnualTotal <= 0) return null;
  return Math.round((valorFinal / economiaAnualTotal) * 365);
}

export interface LinhaProjecao {
  ano: number;
  economiaDoAno: number;
  acumulado: number;
}

/** Projeção de economia acumulada por `anos` anos (padrão 10), aplicando o
 * reajuste tarifário anual configurado (`reajustePercentual`, ver
 * ConfigEmpresa.projecao_reajuste_tarifario_percentual) sobre a economia
 * anual base. Com reajuste 0, a economia do ano é constante — a projeção
 * continua útil (mostra só o acumulado simples), sem assumir nenhum reajuste
 * que a empresa não tenha configurado. É uma ESTIMATIVA de mercado, não uma
 * garantia contratual (ver rodapé da Proposta Comercial). */
export function projetarEconomiaAcumulada(economiaAnualBase: number, reajustePercentual: number, anos = 10): LinhaProjecao[] {
  const linhas: LinhaProjecao[] = [];
  let acumulado = 0;
  for (let ano = 1; ano <= anos; ano++) {
    const economiaDoAno = Number((economiaAnualBase * Math.pow(1 + reajustePercentual / 100, ano - 1)).toFixed(2));
    acumulado = Number((acumulado + economiaDoAno).toFixed(2));
    linhas.push({ ano, economiaDoAno, acumulado });
  }
  return linhas;
}

/** Equivalência ilustrativa "toneladas de CO₂ evitadas" → "árvores
 * plantadas", usando o fator configurável (kg de CO₂ absorvido por uma
 * árvore adulta por ano). Estimativa de comunicação ambiental, não uma
 * métrica de compensação de carbono certificada — ver ConfigEmpresa.
 * co2_kg_por_arvore_ano. */
export function arvoresEquivalentes(co2ToneladasAno: number, kgPorArvoreAno: number): number {
  if (kgPorArvoreAno <= 0) return 0;
  return Math.round((co2ToneladasAno * 1000) / kgPorArvoreAno);
}

/** Prazo de execução estimado (dias úteis), a partir da mão de obra já
 * calculada por trecho (`horas_mao_obra`, automática desde a migração 019) —
 * não é um campo novo, só a soma de um dado que já existe dividida pela
 * jornada configurada. Arredondado para cima (dia parcial conta como dia
 * inteiro de obra). */
export function prazoExecucaoDiasUteis(itens: ItemOrcamento[], horasUteisDia: number): number {
  if (horasUteisDia <= 0) return 0;
  const horasTotais = itens.reduce((acc, i) => acc + (i.horas_mao_obra ?? 0), 0);
  return Math.max(1, Math.ceil(horasTotais / horasUteisDia));
}

/** Prazo de execução exibido nas Propostas. Orçamento com equipe e diárias
 * (migração 048): são os próprios dias de obra cobrados — o prazo e as
 * diárias nunca divergem. Orçamento anterior: a estimativa por horas de
 * sempre (`prazoExecucaoDiasUteis`). */
export function prazoExecucaoDaProposta(
  orcamento: Pick<Orcamento, "mao_obra_equipe" | "horas_uteis_dia">,
  itens: ItemOrcamento[],
  horasUteisDiaPadrao: number
): number {
  const dias = orcamento.mao_obra_equipe?.dias ?? 0;
  if (dias > 0) return dias;
  return prazoExecucaoDiasUteis(itens, orcamento.horas_uteis_dia ?? horasUteisDiaPadrao);
}

/** true quando o orçamento tem dado suficiente para exibir a seção de
 * payback/projeção (precisa de valor final > 0 e alguma economia estimada). */
export function temAnaliseFinanceira(orcamento: Pick<Orcamento, "valor_final">, economiaAnualTotal: number): boolean {
  return orcamento.valor_final > 0 && economiaAnualTotal > 0;
}

/** Descrição completa de um material — nome + especificação (densidade) +
 * espessura calculada num único texto (ex.: "Fibra Cerâmica 96kg/m³ 51mm"),
 * usada nas tabelas das Propostas em vez de colunas separadas. Omite a
 * espessura quando zero/ausente (trechos sem cálculo térmico, ex.: material
 * customizado). Não repete `especificacao_isolante` se ele já estiver
 * contido em `material` (catálogos onde a densidade foi digitada dentro da
 * própria descrição do material, ex. "Lã de Rocha 64kg/m³" + especificação
 * "64kg/m³" seguidos — bug relatado: "Lã de Rocha 64kg/m³ 64kg/m³ 51mm"). */
export function descricaoMaterialCompleta(
  item: Pick<ItemOrcamento, "material" | "especificacao_isolante" | "espessura_necessaria_mm">
): string {
  const jaContemEspecificacao =
    !!item.especificacao_isolante && item.material.toLowerCase().includes(item.especificacao_isolante.toLowerCase());
  const partes = [item.material, jaContemEspecificacao ? null : item.especificacao_isolante].filter(Boolean) as string[];
  if (item.espessura_necessaria_mm > 0) partes.push(`${item.espessura_necessaria_mm}mm`);
  return partes.join(" ");
}

/** O que o orçamento contempla, conforme `tipo_proposta` — usada tanto na
 * Proposta Técnica (seção "Escopo contemplado") quanto na Comercial
 * (Condições Comerciais), pra nunca divergir entre as duas. */
export function itensContemplados(tipoProposta: "material_mo" | "somente_mo"): string[] {
  const itens = ["Mão de obra especializada", "Equipamentos de proteção individual (EPI) da equipe", "Coordenação técnica da execução"];
  if (tipoProposta === "material_mo") itens.push("Material isolante completo", "Acabamentos (chaparia)");
  return itens;
}

/** O que o orçamento NÃO contempla — ver `itensContemplados`. */
export function itensNaoContemplados(tipoProposta: "material_mo" | "somente_mo"): string[] {
  const itens: string[] = [];
  if (tipoProposta === "somente_mo") itens.push("Material isolante e acabamentos (fornecidos pelo cliente)");
  itens.push(
    "Estruturas de acesso para trabalho em altura (andaimes/plataformas), salvo se explicitamente incluídas",
    "Adequações civis/estruturais e remoção de isolamento antigo, salvo se explicitamente incluídas"
  );
  return itens;
}

const igualSemAcento = (a: string, b: string) => normalizar(a) === normalizar(b);
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** "O orçamento contempla" / "Não contemplado" das Propostas, montados a
 * partir do que o orçamento realmente tem (migração 051) — usada pelas
 * Propostas Técnica e Comercial, PDF e Word, pra nunca divergirem.
 *
 *   - Remoção do isolamento existente: contemplada quando algum trecho foi
 *     marcado com remoção (cita os trechos, se não forem todos); senão, não
 *     contemplada.
 *   - Itens de execução padrão (andaime, plataforma, guindauto...): os
 *     habilitados no orçamento entram em "contempla"; os demais do catálogo
 *     são citados em "Não contemplado".
 *   - Itens adicionais de execução digitados à mão num trecho também contam
 *     como contemplados (e saem do "Não contemplado" se tiverem o mesmo nome
 *     de um item do catálogo).
 *
 * Orçamento anterior à migração 051 (sem `itens_execucao`): as listas
 * genéricas de antes (`itensContemplados`/`itensNaoContemplados`), sem
 * mudança. */
export function escopoContemplado(
  orcamento: Pick<Orcamento, "tipo_proposta" | "itens_execucao">,
  itens: ItemOrcamento[]
): { contempla: string[]; naoContempla: string[] } {
  const tipoProposta = orcamento.tipo_proposta ?? "material_mo";
  const catalogo = orcamento.itens_execucao;
  if (!catalogo) return { contempla: itensContemplados(tipoProposta), naoContempla: itensNaoContemplados(tipoProposta) };

  const contempla = itensContemplados(tipoProposta);
  const naoContempla: string[] = [];
  if (tipoProposta === "somente_mo") naoContempla.push("Material isolante e acabamentos (fornecidos pelo cliente)");

  // Remoção do isolamento existente.
  const trechosComRemocao = itens.map((item, index) => (item.remocao_isolamento ? index + 1 : 0)).filter((n) => n > 0);
  if (trechosComRemocao.length > 0) {
    const todos = trechosComRemocao.length === itens.length;
    contempla.push(
      todos ? "Remoção do isolamento existente" : `Remoção do isolamento existente (${trechosComRemocao.length === 1 ? "trecho" : "trechos"} ${trechosComRemocao.join(", ")})`
    );
  }

  // Itens de execução: padrão habilitados + adicionais livres dos trechos.
  const incluidos = catalogo.filter((i) => i.incluido).map((i) => i.nome);
  const livres: string[] = [];
  for (const item of itens) {
    for (const linha of item.detalhamento_materiais ?? []) {
      if (linha.chave === "item_adicional_execucao") livres.push(linha.titulo);
    }
  }
  const execucao: string[] = [];
  for (const nome of [...incluidos, ...livres]) {
    if (!execucao.some((e) => igualSemAcento(e, nome))) execucao.push(nome);
  }
  contempla.push(...execucao);

  if (trechosComRemocao.length === 0) naoContempla.push("Remoção do isolamento existente");
  const foraDoEscopo = catalogo.filter((i) => !i.incluido && !execucao.some((e) => igualSemAcento(e, i.nome))).map((i) => i.nome);
  if (foraDoEscopo.length > 0) naoContempla.push(`Equipamentos e serviços de apoio não incluídos: ${foraDoEscopo.join(", ")}`);
  naoContempla.push("Adequações civis/estruturais, salvo se explicitamente incluídas");

  return { contempla, naoContempla };
}

export interface LinhaEspecificacaoTecnica {
  trechoNumero: number;
  tipoTrabalho: TipoTrabalho;
  /** Material + espessura (via `descricaoMaterialCompleta`) — a chaparia/
   * acabamento não entra nesta tabela (pedido explícito: "não precisamos
   * colocar a chaparia nessa tabela"), mas a espessura sim (pedido
   * explícito: "o ISOLAMENTO deve conter o material e a espessura"). */
  isolamento: string;
  /** Nome do item de escopo (ex.: "Tubo 2\"", "Curva 2\"") — "—" quando o
   * trecho não tem Escopo detalhado (orçamentos legados, só `area_m2`). */
  descricao: string;
  /** Quantidade física na unidade do tipo (ex.: "25 m", "2 un.") — ver
   * `quantidadeEscopoItem`. "—" no fallback legado. */
  qtd: string;
  areaM2: number;
}

/** Uma linha por item de Escopo (não por trecho) — tabela "Especificações
 * Técnicas", igual nas duas Propostas (mesmo nome, mesmo formato). Trechos
 * sem Escopo detalhado (orçamentos anteriores à migração 010) caem numa
 * única linha de fallback com a área total do trecho. */
export function linhasEspecificacoesTecnicas(itens: ItemOrcamento[]): LinhaEspecificacaoTecnica[] {
  const linhas: LinhaEspecificacaoTecnica[] = [];
  itens.forEach((item, index) => {
    const base = { trechoNumero: index + 1, tipoTrabalho: item.tipo_trabalho, isolamento: descricaoMaterialCompleta(item) };
    if ((item.escopo_itens?.length ?? 0) > 0) {
      for (const escopo of item.escopo_itens) {
        linhas.push({ ...base, descricao: escopo.nome, qtd: quantidadeEscopoItem(escopo), areaM2: metragemFinalItem(escopo) });
      }
    } else {
      linhas.push({ ...base, descricao: "—", qtd: "—", areaM2: item.area_m2 });
    }
  });
  return linhas;
}

export interface ResumoFinanceiroSimplificado {
  material: number;
  /** Rótulo exibido nas Propostas/telas é "Execução", não "Mão de Obra"
   * (pedido explícito, migração 026) — esse valor pode incluir itens
   * adicionais de execução (ex.: andaime, linha de vida) além das horas de
   * mão de obra automáticas, então "Mão de Obra" sozinho deixou de
   * descrever tudo que está aqui dentro. O nome do campo continua
   * `maoDeObra` (é `orcamento.valor_mao_obra` por baixo, que também não foi
   * renomeado no banco) — só o texto mostrado ao usuário muda. */
  maoDeObra: number;
}

/** Filtra a galeria de imagens de referência (`imagens_proposta`, migração
 * 022) pro tipo do orçamento — "misto" mostra todas (o projeto toca os dois
 * sistemas); "quente"/"frio" mostram só as marcadas com esse tipo, mais as
 * marcadas "ambos" e as ainda não classificadas (`null`, fotos cadastradas
 * antes da migração 022 — tratadas como "ambos" pra não sumirem da
 * Proposta). */
export function imagensRelevantesParaTipo<T extends { tipo_trabalho: "quente" | "frio" | "ambos" | null }>(
  imagens: T[],
  tipoOrcamento: TipoTrabalho
): T[] {
  if (tipoOrcamento === "misto") return imagens;
  return imagens.filter((img) => img.tipo_trabalho == null || img.tipo_trabalho === "ambos" || img.tipo_trabalho === tipoOrcamento);
}

/** Resumo financeiro reduzido a 2 linhas + total (pedido explícito: "o
 * cliente não pode ver nossas informações brutas, nem saber quanto temos de
 * margens e impostos") — reparte `valor_final` (já com impostos/margem)
 * proporcionalmente entre Material e Mão de Obra (que absorve também
 * deslocamento/hospedagem/frete, ver comentário abaixo), preservando a MESMA
 * % de imposto/margem embutida nas duas categorias. `maoDeObra` absorve o
 * arredondamento — a soma das duas linhas bate exatamente com `valor_final`
 * (mesma técnica de `alocarValorFinalPorTrecho`). */
export function distribuirResumoFinanceiroSimplificado(
  orcamento: Pick<Orcamento, "valor_materiais" | "valor_mao_obra" | "valor_deslocamento" | "valor_hospedagem" | "valor_frete" | "subtotal" | "valor_final">
): ResumoFinanceiroSimplificado {
  if (orcamento.subtotal <= 0) return { material: 0, maoDeObra: orcamento.valor_final };
  const fator = orcamento.valor_final / orcamento.subtotal;
  const material = Number((orcamento.valor_materiais * fator).toFixed(2));
  const maoDeObra = Number((orcamento.valor_final - material).toFixed(2));
  return { material, maoDeObra };
}

/** Casas decimais da quantidade de uma linha da Quantificação: gramas com
 * 1, diárias sem nenhuma (são sempre dias fechados), o resto com 2. */
export function casasDecimaisQuantidade(unidade: string): number {
  if (unidade === "g") return 1;
  if (unidade.startsWith("diária") || unidade === "verba") return 0;
  return 2;
}

export interface LinhaQuantidadeMaterial {
  trechoNumero: number;
  titulo: string;
  quantidade: number;
  unidade: string;
}

/** Quadro 1 da Quantificação (materiais, sem preço — "sem preços unitários
 * nas tabelas") — uma linha por material de `detalhamento_materiais`
 * (persistido desde a migração 020, já com os overrides da Tela 4). Vazio em
 * orçamentos "somente_mo" (não há material) e em orçamentos anteriores à
 * migração 020, que só têm o agregado — quem chama trata esse caso com o
 * fallback mais simples (`material`/`acabamento`/`area_m2` do próprio
 * trecho), igual já era feito antes desta lista existir. */
export function linhasQuantificacaoMateriais(itens: ItemOrcamento[]): LinhaQuantidadeMaterial[] {
  const linhas: LinhaQuantidadeMaterial[] = [];
  itens.forEach((item, index) => {
    for (const linha of item.detalhamento_materiais ?? []) {
      linhas.push({ trechoNumero: index + 1, titulo: linha.titulo, quantidade: linha.quantidade, unidade: linha.unidade });
    }
  });
  return linhas;
}

/** Itens Adicionais de categoria "execução" (ex.: "Remoção de isolamento",
 * "Andaime") de `detalhamento_materiais` — os únicos que fazem sentido
 * aparecer na Quantificação de uma proposta "Somente Mão de Obra": os demais
 * (isolante/acabamento/rebite/parafuso/arame/silicone e itens adicionais de
 * categoria "material") são material de verdade, que "Somente Mão de Obra"
 * não expõe (o cliente fornece por fora — ver `itensContemplados`). Bug
 * relatado: um item adicional de execução entrava certo no valor final
 * (Resumo Financeiro), mas sumia da tabela porque quem chamava descartava a
 * lista de `detalhamento_materiais` INTEIRA pra "Somente Mão de Obra", sem
 * separar o que era material do que era execução. */
export function linhasItensAdicionaisExecucao(itens: ItemOrcamento[]): LinhaQuantidadeMaterial[] {
  const linhas: LinhaQuantidadeMaterial[] = [];
  itens.forEach((item, index) => {
    for (const linha of item.detalhamento_materiais ?? []) {
      if (linha.chave !== "item_adicional_execucao") continue;
      linhas.push({ trechoNumero: index + 1, titulo: linha.titulo, quantidade: linha.quantidade, unidade: linha.unidade });
    }
  });
  return linhas;
}

/** Quadro "Custos Operacionais" da Quantificação — deslocamento/hospedagem/
 * frete/aluguel de carro/alimentação, exibidos só como "Incluso" (sem valor,
 * sem quantidade — "cliente não pode ver nossas informações brutas") — cada
 * um só entra quando o orçamento de fato tem esse custo (> 0). Migração 032:
 * Alimentação passou a ter valor próprio rastreado (diárias ×
 * ConfigEmpresa.valor_diaria_alimentacao), então segue a MESMA regra
 * condicional dos demais agora, em vez de entrar sempre como item padrão sem
 * quantia calculada nenhuma.
 *
 * Mão de obra NÃO entra mais aqui (pedido explícito, rodada "Correções
 * simples": "preciso que a mão de obra fique na lista de materiais... com a
 * quantidade de horas") — ver `linhasMaoDeObra`, que mostra as horas reais
 * junto com os materiais em vez de só "Incluso". */
export function linhasOperacionaisIncluso(
  orcamento: Pick<Orcamento, "valor_deslocamento" | "valor_hospedagem" | "valor_frete" | "valor_aluguel_carro" | "valor_alimentacao">
): string[] {
  const linhas: string[] = [];
  if (orcamento.valor_deslocamento > 0) linhas.push("Deslocamento");
  if (orcamento.valor_hospedagem > 0) linhas.push("Hospedagem");
  if (orcamento.valor_frete > 0) linhas.push("Frete");
  if (orcamento.valor_aluguel_carro > 0) linhas.push("Aluguel de Carro");
  if (orcamento.valor_alimentacao > 0) linhas.push("Alimentação");
  return linhas;
}

/** Mão de obra por trecho, com horas reais — entra na MESMA lista/tabela dos
 * materiais (pedido explícito), não mais como "Incluso" no quadro
 * operacional: o cliente precisa ver quantas horas de trabalho estão
 * previstas. O título deixa explícito que a equipe padrão é uma dupla (2
 * pessoas) — sem isso, "13,1 h" sozinho poderia ser lido como 1 pessoa por
 * 13,1h, quando na verdade são 2 pessoas dividindo esse total. Aparece pros
 * dois tipos de proposta (inclusive "somente_mo", onde é a única linha desta
 * lista) — mão de obra sempre existe, diferente de material. */
export function linhasMaoDeObra(itens: ItemOrcamento[]): LinhaQuantidadeMaterial[] {
  // Só orçamentos anteriores à migração 048 (horas de uma dupla, por trecho)
  // — nos novos a mão de obra é a equipe da proposta, ver
  // `quadrosQuantificacao`.
  return itens
    .map((item, index) => ({ trechoNumero: index + 1, titulo: "Mão de obra (dupla de 2 pessoas)", quantidade: item.horas_mao_obra, unidade: "h" }))
    .filter((linha) => linha.quantidade > 0);
}

/** Um quadro da seção "Quantificação" das Propostas, pronto para desenhar:
 * título, cabeçalho e linhas já formatadas (PDF e Word só percorrem). */
export interface QuadroQuantificacao {
  titulo: string;
  cabecalho: string[];
  linhas: string[][];
}

/** Quadros da "Quantificação" das Propostas — SEPARADOS (pedido explícito),
 * cada um só aparece se tiver linhas:
 *
 *   1. Materiais — o que vem do catálogo e os itens adicionais de categoria
 *      "material". Não existe em proposta "Somente Mão de Obra" (o cliente
 *      fornece o material).
 *   2. Mão de Obra — a equipe: nome da função e quantas pessoas. SEM
 *      quantidade de diárias nem valor (pedido explícito): a estimativa de
 *      duração aparece só no Prazo de Execução. Orçamentos anteriores à
 *      migração 048 não têm equipe e mostram as horas por trecho, como
 *      sempre mostraram.
 *   3. Itens Adicionais de Execução — andaime, linha de vida, remoção de
 *      isolamento... (itens adicionais de categoria "execução").
 *
 * Com mais de um trecho, Materiais e Itens Adicionais ganham a coluna
 * "Trecho"; a equipe é da proposta inteira e não tem essa coluna. */
export function quadrosQuantificacao(
  orcamento: Pick<Orcamento, "tipo_proposta" | "mao_obra_equipe" | "itens_execucao">,
  itens: ItemOrcamento[]
): QuadroQuantificacao[] {
  const comTrecho = itens.length > 1;
  const quantidade = (l: LinhaQuantidadeMaterial) => `${formatarNumeroBr(l.quantidade, casasDecimaisQuantidade(l.unidade))} ${l.unidade}`;
  const porTrecho = (linhas: LinhaQuantidadeMaterial[]) => linhas.map((l) => [...(comTrecho ? [String(l.trechoNumero)] : []), l.titulo, quantidade(l)]);
  const cabecalhoPorTrecho = comTrecho ? ["Trecho", "Item", "Quantidade"] : ["Item", "Quantidade"];

  const quadros: QuadroQuantificacao[] = [];

  if (orcamento.tipo_proposta !== "somente_mo") {
    const materiais: LinhaQuantidadeMaterial[] = [];
    itens.forEach((item, index) => {
      for (const linha of item.detalhamento_materiais ?? []) {
        if (linha.chave === "item_adicional_execucao") continue;
        materiais.push({ trechoNumero: index + 1, titulo: linha.titulo, quantidade: linha.quantidade, unidade: linha.unidade });
      }
    });
    if (materiais.length > 0) quadros.push({ titulo: "Materiais", cabecalho: cabecalhoPorTrecho, linhas: porTrecho(materiais) });
  }

  const equipe = orcamento.mao_obra_equipe;
  if (equipe && equipe.funcoes.length > 0) {
    quadros.push({
      titulo: "Mão de Obra",
      cabecalho: ["Função", "Quantidade"],
      linhas: equipe.funcoes.map((f) => [LABEL_FUNCAO_MAO_OBRA[f.funcao], `${f.pessoas} ${f.pessoas === 1 ? "profissional" : "profissionais"}`]),
    });
  } else {
    const horas = linhasMaoDeObra(itens);
    if (horas.length > 0) quadros.push({ titulo: "Mão de Obra", cabecalho: cabecalhoPorTrecho, linhas: porTrecho(horas) });
  }

  // Itens de execução: os padrão habilitados (valem para o orçamento
  // inteiro — "Geral" na coluna Trecho) + os adicionais livres de cada trecho.
  const execucaoPadrao = (orcamento.itens_execucao ?? [])
    .filter((i) => i.incluido && i.quantidade > 0)
    .map((i) => [
      ...(comTrecho ? ["Geral"] : []),
      i.nome,
      // "2 diárias", não "2 diária" — a unidade do catálogo vem no singular.
      `${formatarNumeroBr(i.quantidade, casasDecimaisQuantidade(i.unidade))} ${i.unidade === "diária" && i.quantidade !== 1 ? "diárias" : i.unidade}`,
    ]);
  const execucao = [...execucaoPadrao, ...porTrecho(linhasItensAdicionaisExecucao(itens))];
  if (execucao.length > 0) quadros.push({ titulo: "Itens Adicionais de Execução", cabecalho: cabecalhoPorTrecho, linhas: execucao });

  return quadros;
}

function formatarNumeroBr(valor: number, casas: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(valor);
}
