// Geração das Propostas Técnica e Comercial em Word (.docx) — REESCRITO
// (pedido explícito: "as propostas em word não estão no mesmo padrão...
// deveriam ser idênticas para possibilitar ajustes pontuais") pra visualmente
// bater com as versões em PDF nativo (components/pdf-native/*.tsx): capa cheia
// na cor da marca, cabeçalho/rodapé repetidos em toda página, caixa de
// cliente destacada, tabelas com cabeçalho sombreado, e os cartões
// destacados (Resumo Financeiro, ROI, Benefícios Ambientais) com fundo
// colorido em vez de tabelas soltas. Mesma fonte de dados/cálculo do PDF
// (lib/usecases/orcamento) — só a camada de desenho muda, usando a API da
// lib `docx` (Document/Section/Table/Paragraph) em vez do StyleSheet do
// @react-pdf/renderer.
//
// Estrutura em 2 SEÇÕES do Word (`Document.sections`), cada uma com sua
// própria página/margem — mesmo efeito da capa em <Page> isolada do PDF:
//   1ª seção — capa: margem zero, uma tabela de 1 célula ocupando a página
//      inteira (297mm de altura fixa), fundo navy, sem cabeçalho/rodapé.
//   2ª seção — conteúdo: margens normais, cabeçalho/rodapé de verdade
//      (Header/Footer do Word, repetem sozinhos em toda página nova — não
//      precisa de `fixed`/render manual como no react-pdf).
//
// A versão Word NÃO inclui as imagens de referência (só o PDF embute imagem
// via @react-pdf/renderer sem round-trip de rede extra).

import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type ISectionOptions,
} from "docx";
import { formatarData, formatarMoeda, formatarNumero } from "./format";
import {
  arvoresEquivalentes,
  calcularBeneficiosConsolidados,
  calcularPaybackMeses,
  descricaoMaterialCompleta,
  distribuirResumoFinanceiroSimplificado,
  itensContemplados,
  itensNaoContemplados,
  linhasEspecificacoesTecnicas,
  linhasMaoDeObra,
  linhasOperacionaisIncluso,
  linhasQuantificacaoMateriais,
  prazoExecucaoDiasUteis,
  projetarEconomiaAcumulada,
  temAnaliseFinanceira,
} from "./usecases/orcamento";
import type { ConfigEmpresa, Orcamento } from "./types";

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };
const LABEL_TIPO_COMPLETO: Record<string, string> = {
  quente: "Isolamento Térmico Quente",
  frio: "Isolamento Térmico Frio",
  misto: "Isolamento Térmico Misto (Quente + Frio)",
};
const LABEL_PROPOSTA: Record<string, string> = { material_mo: "Material + Mão de Obra", somente_mo: "Somente Mão de Obra" };

// Mesma paleta de components/pdf-native/estilos.ts#CORES.
const COR_BRAND = "060035";
const COR_BRAND_LIGHT = "E4E1F0";
const COR_ACCENT = "078B41";
const COR_ACCENT_LIGHT = "DCF3E3";
const COR_ERRO = "DC3545";
const COR_CINZA = "333333";
const COR_CINZA_CLARO = "6B7280";
const COR_BORDA = "E5E7EB";
const COR_BRANCO = "FFFFFF";

// Sem "(proposto)"/"(situação atual)" (pedido explícito) — ver mesmo
// comentário em components/pdf-native/PropostaComercialDocument.tsx.
const NOTA_ESTIMATIVA_COMPARATIVA =
  "Estimativa comparativa entre o cenário COM isolamento térmico e o cenário SEM isolamento, com base nos parâmetros informados nesta proposta — não é uma garantia contratual.";

// ---------------------------------------------------------------------------
// Bordas — helpers de baixo nível reaproveitados por tabela/caixa/linha.
// ---------------------------------------------------------------------------

const SEM_BORDA: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const BORDA_TABELA: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: COR_BORDA };

function semBordasTabela() {
  return { top: SEM_BORDA, bottom: SEM_BORDA, left: SEM_BORDA, right: SEM_BORDA, insideHorizontal: SEM_BORDA, insideVertical: SEM_BORDA };
}
function bordasTabelaConteudo() {
  return { top: BORDA_TABELA, bottom: BORDA_TABELA, left: BORDA_TABELA, right: BORDA_TABELA, insideHorizontal: BORDA_TABELA, insideVertical: BORDA_TABELA };
}
function celulaSemBorda() {
  return { top: SEM_BORDA, bottom: SEM_BORDA, left: SEM_BORDA, right: SEM_BORDA };
}

// ---------------------------------------------------------------------------
// Blocos de texto simples (parágrafos)
// ---------------------------------------------------------------------------

function paragrafoItem(texto: string): Paragraph {
  return new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: `• ${texto}`, size: 20, color: COR_CINZA })] });
}

/** Título de tópico numerado ("N. Escopo") — bold, navy, maiúsculo, mesmo
 * efeito visual de `estilos.secaoTitulo` no PDF. `quebrarPagina` empurra o
 * primeiro tópico da página de conteúdo pra depois da capa. */
function tituloSecao(texto: string, opts: { quebrarPagina?: boolean; before?: number } = {}): Paragraph {
  return new Paragraph({
    pageBreakBefore: opts.quebrarPagina,
    spacing: { before: opts.before ?? 260, after: 110 },
    children: [new TextRun({ text: texto.toUpperCase(), bold: true, color: COR_BRAND, size: 22 })],
  });
}

/** Subtítulo dentro de um tópico ("Retorno do Investimento", "Trecho 1
 * (Quente)"...) — mesmo efeito de `estilos.blocoTitulo`. */
function subTitulo(texto: string, opts: { before?: number; cor?: string; tamanho?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { before: opts.before ?? 140, after: 50 },
    children: [new TextRun({ text: texto, bold: true, color: opts.cor ?? COR_CINZA, size: opts.tamanho ?? 21 })],
  });
}

function paragrafoNota(texto: string): Paragraph {
  return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: texto, italics: true, size: 18, color: COR_CINZA_CLARO })] });
}

// ---------------------------------------------------------------------------
// Tabelas de dados (Especificações Técnicas, Quantificação, Parâmetros...)
// ---------------------------------------------------------------------------

function celula(texto: string, opts: { negrito?: boolean; cor?: string } = {}): TableCell {
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 70, right: 70 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: texto, bold: opts.negrito, color: opts.cor ?? COR_CINZA, size: 18 })] }),
    ],
  });
}

function celulaCabecalho(texto: string): TableCell {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: COR_BRAND_LIGHT, color: "auto" },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 70, bottom: 70, left: 70, right: 70 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: texto.toUpperCase(), bold: true, color: COR_BRAND, size: 17 })] }),
    ],
  });
}

function linhaCabecalho(colunas: string[]): TableRow {
  return new TableRow({ tableHeader: true, children: colunas.map(celulaCabecalho) });
}

function tabelaDados(cabecalho: string[], linhas: TableRow[]): Table {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordasTabelaConteudo(), rows: [linhaCabecalho(cabecalho), ...linhas] });
}

// ---------------------------------------------------------------------------
// Caixa destacada (fundo colorido, opcionalmente com borda esquerda) — usada
// pra "Cliente"/"Dados do Projeto", "Resumo Financeiro", "ROI" e "Benefícios
// Ambientais". Uma tabela de 1 célula é o jeito nativo do Word de conseguir
// um "cartão" com fundo colorido — igual `estilos.caixaCliente`/
// `totalCaixa`/`blocoDestaque` no PDF, que são só `<View>` com
// backgroundColor.
// ---------------------------------------------------------------------------

function caixa(conteudo: Array<Paragraph | Table>, opts: { fill: string; bordaEsquerda?: string } = { fill: COR_BRAND_LIGHT }): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: SEM_BORDA,
      right: SEM_BORDA,
      bottom: SEM_BORDA,
      left: opts.bordaEsquerda ? { style: BorderStyle.SINGLE, size: 24, color: opts.bordaEsquerda } : SEM_BORDA,
      insideHorizontal: SEM_BORDA,
      insideVertical: SEM_BORDA,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: conteudo,
          }),
        ],
      }),
    ],
  });
}

/** Espaço em branco depois de uma caixa — tabelas não têm margem própria no
 * Word, então um parágrafo vazio faz esse papel (equivalente ao
 * `marginBottom` das caixas no PDF). */
function espaco(pontos = 200): Paragraph {
  return new Paragraph({ spacing: { before: pontos } });
}

/** Linha "label ........ valor", usada dentro do card de Resumo Financeiro —
 * uma mini-tabela de 2 colunas sem borda visível a não ser a linha inferior
 * (mesmo efeito de `estilos.linhaFinanceira`, que é um `<View>` flexbox com
 * `justifyContent: space-between` e borda inferior fina). */
function linhaFinanceira(label: string, valor: string, destaque = false): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: SEM_BORDA, left: SEM_BORDA, right: SEM_BORDA, bottom: { style: BorderStyle.SINGLE, size: 3, color: "D1D5DB" }, insideHorizontal: SEM_BORDA, insideVertical: SEM_BORDA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60 },
            borders: celulaSemBorda(),
            children: [new Paragraph({ children: [new TextRun({ text: label, color: COR_CINZA_CLARO, size: 20 })] })],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60 },
            borders: celulaSemBorda(),
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: valor, bold: true, color: destaque ? COR_ACCENT : COR_CINZA, size: 20 })] })],
          }),
        ],
      }),
    ],
  });
}

/** Linha "VALOR TOTAL" — borda superior navy, valor grande em verde (mesmo
 * efeito de `estilos.totalLinha`). */
function linhaValorTotal(valor: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 8, color: COR_BRAND }, left: SEM_BORDA, right: SEM_BORDA, bottom: SEM_BORDA, insideHorizontal: SEM_BORDA, insideVertical: SEM_BORDA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            margins: { top: 100 },
            borders: celulaSemBorda(),
            children: [new Paragraph({ children: [new TextRun({ text: "VALOR TOTAL", bold: true, color: COR_BRAND, size: 21 })] })],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            margins: { top: 100 },
            borders: celulaSemBorda(),
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: valor, bold: true, color: COR_ACCENT, size: 34 })] })],
          }),
        ],
      }),
    ],
  });
}

/** Linha grande do card de ROI ("Investimento — R$ X") — mesmo efeito de
 * `estilos.roiLinhaGrande`. */
function linhaRoiGrande(label: string, valor: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: semBordasTabela(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 40 },
            borders: celulaSemBorda(),
            children: [new Paragraph({ children: [new TextRun({ text: label, color: COR_CINZA, size: 21 })] })],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 40 },
            borders: celulaSemBorda(),
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: valor, bold: true, color: COR_ACCENT, size: 36 })] })],
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Capa — tabela de 1 célula ocupando a página inteira (297×210mm), fundo
// navy, conteúdo branco centralizado — mesmo efeito de
// components/pdf-native/CapaProposta.tsx (`estilos.paginaCapa`).
// ---------------------------------------------------------------------------

async function carregarLogo(): Promise<ArrayBuffer> {
  const resposta = await fetch("/logo.png");
  return resposta.arrayBuffer();
}

function secaoCapa(tipo: "Técnica" | "Comercial", orcamento: Orcamento, logo: ArrayBuffer): ISectionOptions {
  const local = [orcamento.cliente?.cidade, orcamento.cliente?.estado].filter(Boolean).join(" - ");

  const conteudo: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new ImageRun({ type: "png", data: logo, transformation: { width: 190, height: 190 } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: `PROPOSTA ${tipo.toUpperCase()}`, bold: true, color: COR_BRANCO, size: 52 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 700 },
      children: [new TextRun({ text: "Isolamento Térmico Industrial", color: COR_BRAND_LIGHT, size: 26 })],
    }),
    ...(orcamento.cliente?.nome
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 70 },
            children: [new TextRun({ text: orcamento.cliente.nome, bold: true, color: COR_BRANCO, size: 30 })],
          }),
        ]
      : []),
    ...(local
      ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 70 }, children: [new TextRun({ text: local, color: COR_BRAND_LIGHT, size: 22 })] })]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 900 },
      children: [new TextRun({ text: `Nº ${orcamento.numero} · ${formatarData(orcamento.data_criacao)}`, color: COR_BRAND_LIGHT, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "BR Isolamentos — Soluções em Isolamentos Térmicos · Mogi das Cruzes, SP", color: COR_BRAND_LIGHT, size: 18 })],
    }),
  ];

  return {
    properties: {
      page: {
        size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
        margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 },
      },
    },
    // Capa sem cabeçalho/rodapé repetido — só o conteúdo da própria página.
    headers: { default: new Header({ children: [] }) },
    footers: { default: new Footer({ children: [] }) },
    children: [
      new Table({
        width: { size: convertMillimetersToTwip(210), type: WidthType.DXA },
        borders: semBordasTabela(),
        rows: [
          new TableRow({
            height: { value: convertMillimetersToTwip(297), rule: HeightRule.EXACT },
            children: [
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.CLEAR, fill: COR_BRAND, color: "auto" },
                children: conteudo,
              }),
            ],
          }),
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Cabeçalho/rodapé das páginas de conteúdo — repetem sozinhos em toda página
// (recurso nativo do Word), substituindo o `fixed`/render manual do PDF.
// ---------------------------------------------------------------------------

function linhaDivisoria(cor: string, posicao: "top" | "bottom"): Paragraph {
  return new Paragraph({ border: { [posicao]: { style: BorderStyle.SINGLE, size: 10, color: cor, space: 4 } } as never, spacing: { after: 0 } });
}

function cabecalhoConteudo(orcamento: Orcamento, tituloDocumento: string): Header {
  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: semBordasTabela(),
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: celulaSemBorda(),
                children: [
                  new Paragraph({ children: [new TextRun({ text: "BR ISOLAMENTOS", bold: true, color: COR_BRAND, size: 26 })] }),
                  new Paragraph({ children: [new TextRun({ text: tituloDocumento, bold: true, color: COR_BRAND, size: 20 })] }),
                ],
              }),
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: celulaSemBorda(),
                children: [
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Nº ${orcamento.numero}`, bold: true, color: COR_BRAND, size: 19 })] }),
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatarData(orcamento.data_criacao), color: COR_CINZA_CLARO, size: 17 })] }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: LABEL_TIPO_COMPLETO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho, color: COR_CINZA_CLARO, size: 17 })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      linhaDivisoria(COR_ACCENT, "bottom"),
    ],
  });
}

function rodapeConteudo(configEmpresa: ConfigEmpresa | null | undefined, notaRodape: string): Footer {
  const contato = [configEmpresa?.telefone_empresa, configEmpresa?.email_empresa].filter(Boolean).join("  ·  ");
  return new Footer({
    children: [
      linhaDivisoria(COR_ACCENT, "top"),
      new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: "BR ISOLAMENTOS — SOLUÇÕES EM ISOLAMENTOS TÉRMICOS", bold: true, color: COR_ACCENT, size: 16 })] }),
      ...(contato ? [new Paragraph({ children: [new TextRun({ text: contato, color: COR_CINZA_CLARO, size: 16 })] })] : []),
      new Paragraph({ children: [new TextRun({ text: notaRodape, italics: true, color: "9CA3AF", size: 14 })] }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], color: COR_CINZA_CLARO, size: 17 })],
      }),
    ],
  });
}

function margensConteudo() {
  return {
    top: convertMillimetersToTwip(32),
    bottom: convertMillimetersToTwip(28),
    left: convertMillimetersToTwip(15),
    right: convertMillimetersToTwip(15),
    header: convertMillimetersToTwip(12),
    footer: convertMillimetersToTwip(14),
  };
}

// ---------------------------------------------------------------------------
// Caixa "Cliente" (Comercial) / "Dados do Projeto" (Técnica) — faltava
// inteira na versão anterior do Word; existe desde sempre no PDF
// (`estilos.caixaCliente`), logo após o cabeçalho fixo.
// ---------------------------------------------------------------------------

function linhaClienteTexto(texto: string): Paragraph {
  return new Paragraph({ spacing: { before: 30 }, children: [new TextRun({ text: texto, color: COR_CINZA_CLARO, size: 19 })] });
}

function blocoCliente(orcamento: Orcamento, variante: "comercial" | "tecnica", validadeDias: number): Table {
  const cli = orcamento.cliente;
  const local = [cli?.cidade, cli?.estado].filter(Boolean).join(" - ");
  const conteudo: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: variante === "comercial" ? "CLIENTE" : "DADOS DO PROJETO", bold: true, color: COR_BRAND, size: 18 })] }),
    new Paragraph({ children: [new TextRun({ text: cli?.nome ?? "", bold: true, color: COR_CINZA, size: 23 })] }),
  ];

  if (variante === "comercial") {
    if (cli?.razao_social) conteudo.push(linhaClienteTexto(cli.razao_social));
    if (cli?.cnpj_cpf) conteudo.push(linhaClienteTexto(cli.cnpj_cpf));
    if (cli?.endereco) conteudo.push(linhaClienteTexto(cli.endereco));
    const contato = [cli?.telefone, cli?.email].filter(Boolean).join("  ·  ");
    if (contato) conteudo.push(linhaClienteTexto(contato));
    conteudo.push(
      linhaClienteTexto(
        `Escopo: ${LABEL_PROPOSTA[orcamento.tipo_proposta] ?? orcamento.tipo_proposta} · ${LABEL_TIPO_COMPLETO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}`
      )
    );
  } else {
    if (local) conteudo.push(linhaClienteTexto(local));
    conteudo.push(
      linhaClienteTexto(
        `Tipo de sistema: ${LABEL_TIPO_COMPLETO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho} · Modalidade: ${LABEL_PROPOSTA[orcamento.tipo_proposta] ?? orcamento.tipo_proposta}`
      )
    );
    conteudo.push(linhaClienteTexto(`Normas aplicadas: ASTM C680, ISO 12241, ABNT NBR 16281 · Validade da proposta: ${validadeDias} dias`));
  }

  return caixa(conteudo, { fill: COR_BRAND_LIGHT });
}

// ---------------------------------------------------------------------------
// Blocos compartilhados entre as duas Propostas (mesmo conteúdo/formato,
// pedido explícito — ver comentário equivalente em PropostaComercialDocument).
// ---------------------------------------------------------------------------

/** Bloco "Escopo" — lista de itens por trecho + "O orçamento contempla"/"Não
 * contemplado" empilhados. */
function blocoEscopo(itens: Orcamento["itens"], tipoProposta: Orcamento["tipo_proposta"]): Array<Paragraph> {
  const children: Paragraph[] = [];
  (itens ?? []).forEach((item, index) => {
    children.push(
      subTitulo(`Trecho ${index + 1} (${LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho})${item.trabalho_altura ? " · trabalho em altura" : ""}`, {
        before: index === 0 ? 0 : 100,
      })
    );
    if ((item.escopo_itens?.length ?? 0) > 0) {
      for (const escopo of item.escopo_itens) children.push(paragrafoItem(escopo.nome));
    } else {
      children.push(paragrafoItem(`${formatarNumero(item.area_m2)} m²`));
    }
  });
  children.push(subTitulo("O orçamento contempla", { cor: COR_ACCENT, before: 180, tamanho: 19 }), ...itensContemplados(tipoProposta).map(paragrafoItem));
  children.push(subTitulo("Não contemplado", { cor: COR_ERRO, before: 140, tamanho: 19 }), ...itensNaoContemplados(tipoProposta).map(paragrafoItem));
  return children;
}

/** Tabela "Especificações Técnicas" — uma linha por item de Escopo. */
function tabelaEspecificacoesTecnicas(itens: Orcamento["itens"]): Table {
  const linhas = linhasEspecificacoesTecnicas(itens ?? []);
  return tabelaDados(
    ["Trecho", "Tipo", "Isolamento", "Descrição", "Qtd.", "Área"],
    linhas.map(
      (linha) =>
        new TableRow({
          children: [
            celula(String(linha.trechoNumero)),
            celula(LABEL_TIPO[linha.tipoTrabalho] ?? linha.tipoTrabalho),
            celula(linha.isolamento),
            celula(linha.descricao),
            celula(linha.qtd),
            celula(`${formatarNumero(linha.areaM2)} m²`),
          ],
        })
    )
  );
}

/** "Quantificação de Materiais e Mão de Obra" — tabela + "Custos
 * Operacionais" (Incluso, sem quantidade/valor). */
function blocoQuantificacao(itens: NonNullable<Orcamento["itens"]>, orcamento: Orcamento): Array<Paragraph | Table> {
  const somenteMaoObra = orcamento.tipo_proposta === "somente_mo";
  const linhasQuadro1 = [...(somenteMaoObra ? [] : linhasQuantificacaoMateriais(itens)), ...linhasMaoDeObra(itens)];

  const children: Array<Paragraph | Table> = [];
  if (linhasQuadro1.length > 0) {
    children.push(
      subTitulo(somenteMaoObra ? "Execução" : "Materiais e Mão de Obra"),
      tabelaDados(
        itens.length > 1 ? ["Trecho", "Item", "Quantidade"] : ["Item", "Quantidade"],
        linhasQuadro1.map(
          (linha) =>
            new TableRow({
              children: [
                ...(itens.length > 1 ? [celula(String(linha.trechoNumero))] : []),
                celula(linha.titulo),
                celula(`${formatarNumero(linha.quantidade, linha.unidade === "g" ? 1 : 2)} ${linha.unidade}`),
              ],
            })
        )
      )
    );
  }
  children.push(subTitulo("Custos Operacionais", { before: linhasQuadro1.length > 0 ? 200 : 0 }));
  children.push(...linhasOperacionaisIncluso(orcamento).map((label) => paragrafoItem(`${label}: Incluso`)));
  return children;
}

// ---------------------------------------------------------------------------
// Proposta Comercial
// ---------------------------------------------------------------------------

export async function gerarPropostaComercialDocx(orcamento: Orcamento, configEmpresa?: ConfigEmpresa | null): Promise<Blob> {
  const logo = await carregarLogo();
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const somenteMaoObra = orcamento.tipo_proposta === "somente_mo";

  const { economiaAnualTotal, co2ToneladasAno } = calcularBeneficiosConsolidados(itens);
  const temFinanceiro = temAnaliseFinanceira(orcamento, economiaAnualTotal);
  // Tópico "ROI e Projeção Econômica" (pedido explícito) só existe pra
  // Material + Mão de Obra — pra "Somente Mão de Obra" não dá pra calcular
  // ROI de verdade, porque o valor pago em material não é conhecido.
  const paybackMeses = !somenteMaoObra && temFinanceiro ? calcularPaybackMeses(orcamento.valor_final, economiaAnualTotal) : null;
  const reajuste = configEmpresa?.projecao_reajuste_tarifario_percentual ?? 3;
  const projecaoDezAnos = !somenteMaoObra && economiaAnualTotal > 0 ? projetarEconomiaAcumulada(economiaAnualTotal, reajuste, 10) : [];
  const arvores = arvoresEquivalentes(co2ToneladasAno, configEmpresa?.co2_kg_por_arvore_ano ?? 22);
  const prazoDias = configEmpresa ? prazoExecucaoDiasUteis(itens, configEmpresa.horas_uteis_dia) : null;
  const descontoAvista = configEmpresa?.desconto_avista_percentual ?? 5;
  const garantiaMeses = configEmpresa?.garantia_mao_obra_meses ?? 12;
  const validadeDias = configEmpresa?.validade_proposta_dias ?? 30;
  const formaPagamentoPadrao = configEmpresa?.forma_pagamento_padrao || "50% de entrada + 50% na conclusão dos trabalhos";
  const resumoSimplificado = distribuirResumoFinanceiroSimplificado(orcamento);
  const temTopicoRoi = !somenteMaoObra && economiaAnualTotal > 0;

  const children: Array<Paragraph | Table> = [];
  let n = 1;

  children.push(blocoCliente(orcamento, "comercial", validadeDias), espaco());

  children.push(tituloSecao(`${n++}. Escopo`));
  children.push(...blocoEscopo(itens, orcamento.tipo_proposta));

  children.push(tituloSecao(`${n++}. Especificações Técnicas`));
  children.push(tabelaEspecificacoesTecnicas(itens));

  children.push(tituloSecao(`${n++}. Quantificação de ${somenteMaoObra ? "Mão de Obra" : "Materiais e Mão de Obra"}`));
  children.push(...blocoQuantificacao(itens, orcamento));

  if (temTopicoRoi) {
    children.push(tituloSecao(`${n++}. ROI e Projeção Econômica`), paragrafoNota(NOTA_ESTIMATIVA_COMPARATIVA));
    if (paybackMeses != null) {
      children.push(
        caixa(
          [
            subTitulo("Retorno do Investimento", { cor: COR_ACCENT, before: 0, tamanho: 23 }),
            linhaRoiGrande("Investimento", formatarMoeda(orcamento.valor_final)),
            linhaRoiGrande("Economia anual estimada", formatarMoeda(economiaAnualTotal)),
            linhaRoiGrande("Payback estimado", `${formatarNumero(paybackMeses, 1)} meses`),
          ],
          { fill: COR_ACCENT_LIGHT, bordaEsquerda: COR_ACCENT }
        ),
        espaco()
      );
    }
    if (projecaoDezAnos.length > 0) {
      children.push(
        subTitulo("Projeção de economia acumulada (10 anos)"),
        paragrafoNota(
          reajuste > 0
            ? `Projeção com reajuste tarifário estimado de ${formatarNumero(reajuste, 1)}% ao ano — estimativa de mercado, não uma garantia contratual.`
            : "Projeção com economia anual constante (sem reajuste tarifário assumido)."
        ),
        tabelaDados(
          ["Ano", "Economia do ano", "Acumulado"],
          projecaoDezAnos.map(
            (linha) => new TableRow({ children: [celula(String(linha.ano)), celula(formatarMoeda(linha.economiaDoAno)), celula(formatarMoeda(linha.acumulado))] })
          )
        )
      );
    }
  }

  if (economiaAnualTotal > 0 || co2ToneladasAno > 0) {
    const beneficios: Array<Paragraph> = [tituloSecao(`${n++}. Benefícios Ambientais`, { before: 0 }), paragrafoNota(NOTA_ESTIMATIVA_COMPARATIVA)];
    if (economiaAnualTotal > 0) beneficios.push(paragrafoItem(`Economia anual estimada de energia: ${formatarMoeda(economiaAnualTotal)}`));
    if (co2ToneladasAno > 0) beneficios.push(paragrafoItem(`Redução de emissão de CO₂: ${formatarNumero(co2ToneladasAno, 2)} toneladas/ano`));
    if (arvores > 0) beneficios.push(paragrafoItem(`Equivalência ilustrativa: cerca de ${arvores} árvores plantadas por ano`));
    beneficios.push(
      new Paragraph({
        spacing: { before: 60 },
        children: [
          new TextRun({
            text: "Equivalência de árvores é uma estimativa ilustrativa (fator configurável), não uma métrica de compensação de carbono certificada.",
            italics: true,
            size: 16,
            color: COR_CINZA_CLARO,
          }),
        ],
      })
    );
    children.push(caixa(beneficios, { fill: COR_ACCENT_LIGHT, bordaEsquerda: COR_ACCENT }), espaco());
  }

  children.push(
    caixa(
      [
        tituloSecao(`${n++}. Resumo Financeiro`, { before: 0 }),
        // Somente Mão de Obra: linha "Material" continua aparecendo (pedido
        // explícito), só que com "Fornecimento Cliente" no lugar do valor.
        linhaFinanceira("Material", somenteMaoObra ? "Fornecimento Cliente" : formatarMoeda(resumoSimplificado.material)),
        // "Execução" (não "Mão de Obra") — pode incluir itens adicionais de
        // execução (ex.: andaime), não só horas trabalhadas.
        linhaFinanceira("Execução", formatarMoeda(resumoSimplificado.maoDeObra)),
        linhaValorTotal(formatarMoeda(orcamento.valor_final)),
      ],
      { fill: COR_BRAND_LIGHT }
    ),
    espaco()
  );

  children.push(tituloSecao(`${n++}. Condições Comerciais`));
  children.push(subTitulo("Forma de pagamento", { before: 0 }));
  children.push(
    paragrafoItem(`À vista: ${formatarNumero(descontoAvista, 0)}% de desconto`),
    paragrafoItem(formaPagamentoPadrao),
    paragrafoItem("Parcelado: consulte condições")
  );
  children.push(subTitulo("Prazo de execução e validade"));
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text:
            (prazoDias != null
              ? `${prazoDias} dia(s) útil(eis), estimado(s) a partir da mão de obra calculada para esta proposta.`
              : "A confirmar após aceite.") + ` Data de início a combinar com o cliente. Proposta válida por ${validadeDias} dias a partir da emissão.`,
          size: 20,
          color: COR_CINZA,
        }),
      ],
    })
  );
  children.push(subTitulo("Garantias"));
  children.push(paragrafoItem(`Mão de obra: ${garantiaMeses} meses`), paragrafoItem("Materiais: conforme garantia do fabricante"));
  children.push(subTitulo("Responsabilidades — BR Isolamentos"));
  children.push(
    paragrafoItem("Execução conforme especificações técnicas desta proposta"),
    paragrafoItem("Equipe especializada e qualificada"),
    ...(!somenteMaoObra ? [paragrafoItem("Materiais conforme escopo aprovado")] : []),
    paragrafoItem(`Garantia de mão de obra (${garantiaMeses} meses)`),
    paragrafoItem("EPI da própria equipe"),
    paragrafoItem("Limpeza da área de trabalho após a execução"),
    paragrafoItem("Cumprimento das normas de segurança aplicáveis (NRs)")
  );
  children.push(subTitulo("Responsabilidades — Cliente"));
  children.push(
    paragrafoItem("Acesso seguro ao local de trabalho"),
    paragrafoItem("Liberação de segurança conforme protocolos internos"),
    paragrafoItem("Energia e água disponíveis quando necessário"),
    paragrafoItem("Área para estocagem de materiais, quando aplicável"),
    paragrafoItem("Estrutura de apoio para trabalho em altura, quando aplicável"),
    paragrafoItem("Comunicação de mudanças de cronograma com antecedência"),
    paragrafoItem("Coordenação de paradas de equipamento, quando necessário")
  );

  if (orcamento.observacoes_adicionais) {
    children.push(
      tituloSecao("Observações Adicionais"),
      new Paragraph({ children: [new TextRun({ text: orcamento.observacoes_adicionais, size: 21, color: COR_CINZA })] })
    );
  }

  children.push(
    tituloSecao(`${n++}. Próximos Passos`),
    paragrafoItem("Aprovação desta proposta comercial"),
    paragrafoItem("Agendamento de mobilização"),
    paragrafoItem("Execução dos trabalhos no prazo estimado"),
    paragrafoItem("Comissionamento e conferência final"),
    new Paragraph({
      spacing: { before: 100 },
      children: [
        new TextRun({
          text: "Proposta sujeita a alterações por motivos climáticos, de acesso ao local ou força maior. Cálculos de economia baseados nos parâmetros informados no momento da elaboração — alterações tarifárias podem alterar os valores estimados.",
          italics: true,
          size: 16,
          color: COR_CINZA_CLARO,
        }),
      ],
    })
  );

  const notaRodape = `Proposta comercial preparada especialmente para o cliente acima. Orçamento válido por ${validadeDias} dias. Cálculos conforme normas ASTM C680, ISO 12241 e ABNT NBR 16281.`;

  const doc = new Document({
    sections: [
      secaoCapa("Comercial", orcamento, logo),
      {
        properties: { page: { size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) }, margin: margensConteudo() } },
        headers: { default: cabecalhoConteudo(orcamento, "PROPOSTA DE ORÇAMENTO") },
        footers: { default: rodapeConteudo(configEmpresa, notaRodape) },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

export function nomeArquivoDocxComercial(orcamento: Orcamento): string {
  return `Proposta_Comercial_${orcamento.numero}.docx`;
}

// ---------------------------------------------------------------------------
// Proposta Técnica
// ---------------------------------------------------------------------------

export async function gerarPropostaTecnicaDocx(orcamento: Orcamento, configEmpresa?: ConfigEmpresa | null): Promise<Blob> {
  const logo = await carregarLogo();
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const somenteMaoObra = orcamento.tipo_proposta === "somente_mo";
  const itensQuentes = itens.filter((i) => i.tipo_trabalho === "quente");
  const itensFrios = itens.filter((i) => i.tipo_trabalho === "frio");
  const trechosAltura = itens.filter((i) => i.trabalho_altura).length;
  const validadeDias = configEmpresa?.validade_proposta_dias ?? 30;

  const reducoes = itensQuentes
    .filter((i) => i.perda_sem_isolante > 0)
    .map((i) => ((i.perda_sem_isolante - i.perda_com_isolante) / i.perda_sem_isolante) * 100);
  const reducaoMin = reducoes.length > 0 ? Math.min(...reducoes) : null;
  const reducaoMax = reducoes.length > 0 ? Math.max(...reducoes) : null;
  const maiorFaceFria = itensQuentes.reduce((max, i) => (i.temperatura_face_fria != null ? Math.max(max, i.temperatura_face_fria) : max), -Infinity);

  const children: Array<Paragraph | Table> = [];

  children.push(blocoCliente(orcamento, "tecnica", validadeDias), espaco());

  children.push(
    tituloSecao("1. Por que isolar termicamente", { before: 0 }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "O isolamento térmico fixo reduz a troca de calor entre uma superfície (tubulação, equipamento ou envoltória) e o ambiente, trazendo ganhos diretos em quatro frentes: eficiência energética (menos combustível ou energia elétrica para manter a temperatura de processo), segurança (redução da temperatura de superfícies acessíveis, evitando queimaduras), controle de processo (temperaturas mais estáveis) e, em sistemas frios, prevenção de condensação e da corrosão e proliferação de mofo que ela causa ao longo do tempo.",
          size: 21,
          color: COR_CINZA,
        }),
      ],
    })
  );

  let numeroSecao = 2;

  children.push(
    tituloSecao(`${numeroSecao++}. Princípios físicos aplicados`),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "O dimensionamento de cada trecho considera os três mecanismos de transferência de calor atuando em série: condução através da espessura do isolante (regida pela condutividade térmica k do material, que varia com a temperatura), e convecção (natural ou forçada pelo vento) somada à radiação na face externa, trocando calor com o ambiente. O ponto de equilíbrio entre esses mecanismos — a temperatura da face fria do isolamento — é encontrado por método iterativo, seguindo as práticas recomendadas pelas normas ASTM C680 e ISO 12241, em conformidade com a ABNT NBR 16281.",
          size: 21,
          color: COR_CINZA,
        }),
      ],
    })
  );

  if (itensQuentes.length > 0) {
    children.push(
      tituloSecao(`${numeroSecao++}. Eficiência energética e redução de carbono`),
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: 'Em sistemas quentes, cada grau de temperatura perdido pela superfície para o ambiente representa energia comprada e não aproveitada no processo. Isolar reduz essa perda, o que se traduz em menor consumo de combustível ou eletricidade, menor custo operacional recorrente e menor emissão de CO₂ associada à queima desse combustível. Os valores calculados por trecho (perda térmica, economia e CO₂ evitado) estão detalhados na seção "Especificações Técnicas", junto com as demais características de cada trecho.',
            size: 21,
            color: COR_CINZA,
          }),
        ],
      })
    );
  }

  if (itensFrios.length > 0) {
    children.push(
      tituloSecao(`${numeroSecao++}. Prevenção de condensação`),
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: "Em sistemas frios, quando a temperatura da superfície isolada fica abaixo do ponto de orvalho do ar ambiente, o vapor de água presente no ar condensa sobre ela — causando corrosão sob isolamento, formação de mofo e gotejamento. A espessura mínima de cada trecho é calculada (fórmula de Magnus para o ponto de orvalho, combinada com o mesmo método iterativo de equilíbrio térmico) para manter a face fria do isolamento sempre acima dessa temperatura crítica.",
            size: 21,
            color: COR_CINZA,
          }),
        ],
      })
    );
    for (const item of itensFrios) {
      children.push(
        caixa(
          [
            subTitulo(descricaoMaterialCompleta(item), { before: 0 }),
            new Paragraph({ children: [new TextRun({ text: `Espessura mínima recomendada: ${formatarNumero(item.espessura_necessaria_mm, 1)} mm`, size: 21, color: COR_CINZA })] }),
          ],
          { fill: COR_BRAND_LIGHT, bordaEsquerda: COR_BRAND }
        ),
        espaco(100)
      );
    }
    children.push(
      new Paragraph({
        spacing: { before: 40 },
        children: [
          new TextRun({ text: "Atenção — ", bold: true, italics: true, size: 16, color: COR_CINZA_CLARO }),
          new TextRun({
            text: "Variação estimada de ±5%: os cálculos de perda térmica no lado frio dependem de condições operacionais e de propriedades dos materiais isolantes em campo, que podem variar em relação ao projetado — a espessura especificada já incorpora essa margem de segurança.",
            italics: true,
            size: 16,
            color: COR_CINZA_CLARO,
          }),
        ],
      })
    );
  }

  children.push(tituloSecao(`${numeroSecao++}. Escopo`));
  children.push(...blocoEscopo(itens, orcamento.tipo_proposta));

  children.push(tituloSecao(`${numeroSecao++}. Parâmetros de cálculo`));
  children.push(
    tabelaDados(
      ["Trecho", "T. interna", "T. ambiente", "Vento", "Umidade", "Altura"],
      itens.map(
        (item, index) =>
          new TableRow({
            children: [
              celula(String(index + 1)),
              celula(`${formatarNumero(item.temperatura_quente, 0)} °C`),
              celula(`${formatarNumero(item.temperatura_ambiente, 0)} °C`),
              celula(item.velocidade_vento != null ? `${formatarNumero(item.velocidade_vento, 1)} m/s` : "—"),
              celula(item.umidade_relativa != null ? `${formatarNumero(item.umidade_relativa, 0)}%` : "—"),
              celula(item.trabalho_altura ? "Sim" : "Não"),
            ],
          })
      )
    )
  );

  children.push(tituloSecao(`${numeroSecao++}. Especificações Técnicas`));
  children.push(tabelaEspecificacoesTecnicas(itens));

  // Valores calculados de perda/economia por trecho quente — mesmo cartão
  // destacado do PDF (`estilos.blocoDestaque`), logo depois da tabela.
  for (const item of itensQuentes) {
    children.push(
      espaco(160),
      caixa(
        [
          subTitulo(descricaoMaterialCompleta(item), { before: 0 }),
          new Paragraph({ children: [new TextRun({ text: `Perda de calor sem isolante: ${formatarNumero(item.perda_sem_isolante, 3)} kW/m²`, size: 21, color: COR_CINZA })] }),
          new Paragraph({ children: [new TextRun({ text: `Perda de calor com isolante: ${formatarNumero(item.perda_com_isolante, 3)} kW/m²`, size: 21, color: COR_CINZA })] }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Subtotal do trecho: ${formatarNumero(item.perda_com_isolante * item.area_m2, 2)} kW em ${formatarNumero(item.area_m2)} m²`,
                size: 21,
                color: COR_CINZA,
              }),
            ],
          }),
          ...(item.economia_anual != null
            ? [new Paragraph({ children: [new TextRun({ text: `Economia anual estimada: ${formatarMoeda(item.economia_anual)}`, size: 21, color: COR_CINZA })] })]
            : []),
          ...(item.co2_ton_ano != null
            ? [new Paragraph({ children: [new TextRun({ text: `CO₂ evitado por ano: ${formatarNumero(item.co2_ton_ano, 2)} toneladas`, size: 21, color: COR_CINZA })] })]
            : []),
        ],
        { fill: COR_ACCENT_LIGHT, bordaEsquerda: COR_ACCENT }
      )
    );
  }

  children.push(tituloSecao(`${numeroSecao++}. Quantificação de ${somenteMaoObra ? "Mão de Obra" : "Materiais e Mão de Obra"}`));
  children.push(...blocoQuantificacao(itens, orcamento));

  children.push(tituloSecao(`${numeroSecao++}. Metodologia e padrões técnicos`));
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Normas de referência: ", bold: true, size: 21, color: COR_CINZA }),
        new TextRun({
          text: "ASTM C680 (cálculo de transferência de calor em superfícies isoladas), ISO 12241 (isolamento térmico de equipamentos e sistemas industriais) e ABNT NBR 16281 (isolamento térmico — terminologia).",
          size: 21,
          color: COR_CINZA,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Método de cálculo: ", bold: true, size: 21, color: COR_CINZA }),
        new TextRun({
          text: 'resolução iterativa do equilíbrio entre condução (através do isolante), convecção (natural ou forçada) e radiação na face externa — ver seção 2, "Princípios físicos aplicados".',
          size: 21,
          color: COR_CINZA,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Condições consideradas: ", bold: true, size: 21, color: COR_CINZA }),
        new TextRun({
          text: "temperaturas de processo/ambiente, velocidade do vento e (em sistemas frios) umidade relativa informados para cada trecho — ver tabela de parâmetros de cálculo acima.",
          size: 21,
          color: COR_CINZA,
        }),
      ],
    })
  );

  children.push(tituloSecao(`${numeroSecao++}. Conclusões e recomendações`));
  if (reducaoMin != null && reducaoMax != null) {
    children.push(
      paragrafoItem(
        `Redução de perda de calor estimada entre ${formatarNumero(reducaoMin, 1)}% e ${formatarNumero(reducaoMax, 1)}% nos trechos quentes, conforme a análise térmica da seção anterior.`
      )
    );
  }
  if (Number.isFinite(maiorFaceFria)) {
    children.push(
      paragrafoItem(
        `Com o isolamento, a temperatura de face fria estimada fica em até ${formatarNumero(maiorFaceFria, 1)}°C — dentro da faixa geralmente considerada segura ao toque para superfícies acessíveis (referência usual: abaixo de 60°C).`
      )
    );
  }
  if (itensFrios.length > 0) {
    children.push(
      paragrafoItem(
        "Nos trechos frios, a espessura especificada mantém a face fria acima do ponto de orvalho, prevenindo condensação, corrosão sob isolamento e proliferação de mofo."
      )
    );
  }
  if (trechosAltura > 0) {
    children.push(
      paragrafoItem(
        `${trechosAltura} ${trechosAltura === 1 ? "trecho" : "trechos"} desta proposta envolve${trechosAltura === 1 ? "" : "m"} trabalho em altura (acima de 2m) — exige planejamento de acesso e EPIs específicos, já considerado no dimensionamento de mão de obra da Proposta Comercial.`
      )
    );
  }
  children.push(
    new Paragraph({
      spacing: { before: 80 },
      children: [
        new TextRun({
          text: "Recomenda-se a execução de todos os trechos contemplados nesta proposta para maximizar os benefícios de eficiência, segurança e/ou prevenção descritos acima. Após a aprovação técnica, a Proposta Comercial detalha investimento, prazo de execução e condições de pagamento.",
          size: 21,
          color: COR_CINZA,
        }),
      ],
    })
  );

  const notaRodape = `Proposta técnica sem valores comerciais — consulte a Proposta Comercial para o investimento. Orçamento válido por ${validadeDias} dias. Cálculos conforme normas ASTM C680, ISO 12241 e ABNT NBR 16281.`;

  const doc = new Document({
    sections: [
      secaoCapa("Técnica", orcamento, logo),
      {
        properties: { page: { size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) }, margin: margensConteudo() } },
        headers: { default: cabecalhoConteudo(orcamento, "PROPOSTA TÉCNICA") },
        footers: { default: rodapeConteudo(configEmpresa, notaRodape) },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

export function nomeArquivoDocxTecnica(orcamento: Orcamento): string {
  return `Proposta_Tecnica_${orcamento.numero}.docx`;
}
