// Geração das Propostas Técnica e Comercial em Word (.docx) — mesma
// informação das versões em PDF nativo (components/pdf-native/*.tsx),
// construída direto com a lib `docx` em vez de capturar um elemento HTML
// (jsPDF/html2canvas só produzem imagem, não um .docx editável de verdade).
// A versão Word NÃO inclui as imagens de referência (só o PDF embute imagem
// via @react-pdf/renderer sem round-trip de rede extra) — quem precisar
// delas usa o PDF.
//
// Estrutura elaborada (pedidos "PROPOSTAS TÉCNICA E COMERCIAL ELABORADAS",
// "PROPOSTAS DIFERENCIADAS POR TIPO" e "REFATORAÇÃO PROPOSTAS TÉCNICA E
// COMERCIAL") — ver a decisão de arquitetura no topo de components/pdf-native/
// PropostaComercialDocument.tsx: mesmo template para as "6 variações", os
// cálculos de apoio (payback, projeção, equivalência ambiental, prazo,
// contemplado/não contemplado) vêm de lib/usecases/orcamento/
// analiseProposta.ts — a MESMA função usada pelo PDF, pra as duas versões
// nunca divergirem numericamente ou textualmente.
//
// Capa: o Word não tem o conceito de <Page> isolada do PDF, então a "página
// de capa" é o bloco de título/marca no topo do documento, seguido de um
// parágrafo com `pageBreakBefore: true` que empurra o primeiro tópico
// numerado para a página 2 — mesmo efeito visual de uma capa dedicada.

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { formatarData, formatarMoeda, formatarNumero } from "./format";
import {
  arvoresEquivalentes,
  calcularBeneficiosConsolidados,
  calcularPaybackDias,
  calcularPaybackMeses,
  descricaoMaterialCompleta,
  itensContemplados,
  itensNaoContemplados,
  prazoExecucaoDiasUteis,
  projetarEconomiaAcumulada,
  temAnaliseFinanceira,
} from "./usecases/orcamento";
import type { ConfigEmpresa, Orcamento } from "./types";

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };
const LABEL_PROPOSTA: Record<string, string> = { material_mo: "Material + Mão de Obra", somente_mo: "Somente Mão de Obra" };
const COR_MARCA = "060035";
const COR_ACCENT = "078B41";

function celula(texto: string, opts: { negrito?: boolean; cor?: string } = {}): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold: opts.negrito, color: opts.cor })] })],
  });
}

function linhaCabecalho(colunas: string[]): TableRow {
  return new TableRow({ children: colunas.map((c) => celula(c, { negrito: true, cor: "FFFFFF" })) });
}

function paragrafoItem(texto: string): Paragraph {
  return new Paragraph({ text: `• ${texto}`, spacing: { after: 60 } });
}

function titulo3(texto: string, before = 150): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: texto, bold: true })],
    spacing: { before, after: 60 },
  });
}

/** Bloco de capa (marca + título + cliente), com quebra de página logo em
 * seguida — ver comentário no topo do arquivo. */
function blocoCapa(tipo: "Técnica" | "Comercial", orcamento: Orcamento, subtitulo: string): Paragraph[] {
  const local = [orcamento.cliente?.cidade, orcamento.cliente?.estado].filter(Boolean).join(" - ");
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000 },
      children: [new TextRun({ text: "BR ISOLAMENTOS", bold: true, size: 40, color: COR_MARCA })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Soluções em Isolamentos Térmicos", size: 20, color: "6B7280" })],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Proposta ${tipo}`, bold: true, size: 32 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: subtitulo, size: 22, italics: true })],
      spacing: { after: 400 },
    }),
    ...(orcamento.cliente?.nome
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: orcamento.cliente.nome, bold: true, size: 26 })],
          }),
        ]
      : []),
    ...(local
      ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: local, size: 20 })] })]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Nº ${orcamento.numero} · ${formatarData(orcamento.data_criacao)}`, size: 20 })],
      pageBreakBefore: false,
    }),
  ];
}

export async function gerarPropostaComercialDocx(orcamento: Orcamento, configEmpresa?: ConfigEmpresa | null): Promise<Blob> {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const ehLegado = itens.length > 0 && itens[0].manta_kg != null;
  const somenteMaoObra = orcamento.tipo_proposta === "somente_mo";
  const itensComDetalhamento = itens.filter((i) => (i.detalhamento_materiais?.length ?? 0) > 0);
  const temDetalhamentoNovo = !somenteMaoObra && itensComDetalhamento.length > 0;

  const { economiaAnualTotal, co2ToneladasAno } = calcularBeneficiosConsolidados(itens);
  const temFinanceiro = temAnaliseFinanceira(orcamento, economiaAnualTotal);
  const paybackMeses = !somenteMaoObra && temFinanceiro ? calcularPaybackMeses(orcamento.valor_final, economiaAnualTotal) : null;
  const paybackDias = somenteMaoObra && temFinanceiro ? calcularPaybackDias(orcamento.valor_final, economiaAnualTotal) : null;
  const reajuste = configEmpresa?.projecao_reajuste_tarifario_percentual ?? 3;
  const projecaoDezAnos = !somenteMaoObra && economiaAnualTotal > 0 ? projetarEconomiaAcumulada(economiaAnualTotal, reajuste, 10) : [];
  const arvores = arvoresEquivalentes(co2ToneladasAno, configEmpresa?.co2_kg_por_arvore_ano ?? 22);
  const prazoDias = configEmpresa ? prazoExecucaoDiasUteis(itens, configEmpresa.horas_uteis_dia) : null;
  const descontoAvista = configEmpresa?.desconto_avista_percentual ?? 5;
  const garantiaMeses = configEmpresa?.garantia_mao_obra_meses ?? 12;
  const validadeDias = configEmpresa?.validade_proposta_dias ?? 30;
  const formaPagamentoPadrao = configEmpresa?.forma_pagamento_padrao || "50% de entrada + 50% na conclusão dos trabalhos";
  const naoContempla = itensNaoContemplados(orcamento.tipo_proposta);

  const children: Array<Paragraph | Table> = [];
  let n = 1;

  children.push(
    ...blocoCapa(
      "Comercial",
      orcamento,
      `${LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho} · ${LABEL_PROPOSTA[orcamento.tipo_proposta] ?? orcamento.tipo_proposta}`
    )
  );

  children.push(
    new Paragraph({ text: `${n++}. Especificações Técnicas`, heading: HeadingLevel.HEADING_2, pageBreakBefore: true })
  );
  const linhasEspecificacoes = itens.map(
    (item, index) =>
      new TableRow({
        children: [
          celula(String(index + 1)),
          celula(`${item.material}${item.acabamento ? ` · ${item.acabamento}` : ""}`),
          celula(LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho),
          celula(`${formatarNumero(item.area_m2)} m²`),
        ],
      })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [linhaCabecalho(["Trecho", "Material", "Tipo", "Área"]), ...linhasEspecificacoes],
    })
  );

  // Quantificação (item + quantidade, sem preço unitário — pedido explícito
  // desta rodada: "Tabela Quantificação Simplificada").
  if (somenteMaoObra) {
    children.push(
      new Paragraph({ text: `${n++}. Quantificação de Mão de Obra`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
      new Paragraph({
        text: 'Proposta "Somente Mão de Obra" — o material é fornecido pelo cliente e não entra neste investimento.',
        spacing: { after: 100 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          linhaCabecalho(["Trecho", "Horas"]),
          ...itens.map(
            (item, index) =>
              new TableRow({
                children: [
                  celula(`Trecho ${index + 1} (${LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho})`),
                  celula(`${formatarNumero(item.horas_mao_obra ?? 0, 1)} h`),
                ],
              })
          ),
        ],
      })
    );
  } else if (temDetalhamentoNovo) {
    children.push(new Paragraph({ text: `${n++}. Quantificação de Materiais e Mão de Obra`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }));
    for (const [index, item] of itens.entries()) {
      if ((item.detalhamento_materiais?.length ?? 0) === 0 && item.horas_mao_obra <= 0) continue;
      if (itens.length > 1) children.push(titulo3(`Trecho ${index + 1} — ${item.material}`));
      const linhasMateriais = item.detalhamento_materiais.map(
        (linha) => new TableRow({ children: [celula(linha.titulo), celula(`${formatarNumero(linha.quantidade, linha.unidade === "g" ? 1 : 2)} ${linha.unidade}`)] })
      );
      if (item.horas_mao_obra > 0) {
        linhasMateriais.push(new TableRow({ children: [celula("Mão de obra (dupla)"), celula(`${formatarNumero(item.horas_mao_obra, 1)} h`)] }));
      }
      children.push(
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [linhaCabecalho(["Item", "Quantidade"]), ...linhasMateriais] })
      );
    }
  } else if (!ehLegado && itens.length > 0) {
    children.push(
      new Paragraph({ text: `${n++}. Materiais por Trecho`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          linhaCabecalho(["Trecho", "Isolante", "Acabamento", "Metragem", "Mão de obra"]),
          ...itens.map(
            (item, index) =>
              new TableRow({
                children: [
                  celula(String(index + 1)),
                  celula(item.material),
                  celula(item.acabamento ?? "—"),
                  celula(`${formatarNumero(item.area_m2)} m²`),
                  celula(`${formatarNumero(item.horas_mao_obra ?? 0, 1)}h`),
                ],
              })
          ),
        ],
      })
    );
  }

  // Resumo Financeiro simplificado — sem itemização de impostos por nome/%,
  // sem percentual de margem (pedido explícito desta rodada).
  children.push(new Paragraph({ text: `${n++}. Resumo Financeiro`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }));
  const linhasFinanceiro: TableRow[] = [];
  if (!somenteMaoObra) linhasFinanceiro.push(new TableRow({ children: [celula("Materiais"), celula(formatarMoeda(orcamento.valor_materiais))] }));
  linhasFinanceiro.push(new TableRow({ children: [celula("Mão de Obra"), celula(formatarMoeda(orcamento.valor_mao_obra))] }));
  if (orcamento.valor_deslocamento > 0) linhasFinanceiro.push(new TableRow({ children: [celula("Deslocamento"), celula(formatarMoeda(orcamento.valor_deslocamento))] }));
  if (orcamento.valor_hospedagem > 0) linhasFinanceiro.push(new TableRow({ children: [celula("Hospedagem"), celula(formatarMoeda(orcamento.valor_hospedagem))] }));
  if (orcamento.valor_frete > 0) linhasFinanceiro.push(new TableRow({ children: [celula("Frete"), celula(formatarMoeda(orcamento.valor_frete))] }));
  linhasFinanceiro.push(new TableRow({ children: [celula("Subtotal", { negrito: true }), celula(formatarMoeda(orcamento.subtotal), { negrito: true })] }));
  linhasFinanceiro.push(new TableRow({ children: [celula("Impostos & Encargos"), celula(formatarMoeda(orcamento.total_impostos))] }));
  linhasFinanceiro.push(new TableRow({ children: [celula("Margem Operacional"), celula(formatarMoeda(orcamento.margem_lucro))] }));
  if (orcamento.valor_desconto > 0) linhasFinanceiro.push(new TableRow({ children: [celula("Desconto comercial"), celula(`- ${formatarMoeda(orcamento.valor_desconto)}`)] }));
  linhasFinanceiro.push(
    new TableRow({
      children: [celula("VALOR TOTAL", { negrito: true }), celula(formatarMoeda(orcamento.valor_final), { negrito: true, cor: COR_ACCENT })],
    })
  );
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: linhasFinanceiro }));

  if (!somenteMaoObra && paybackMeses != null) {
    children.push(
      titulo3("Análise de Retorno do Investimento", 300),
      new Paragraph({ text: `Investimento: ${formatarMoeda(orcamento.valor_final)}` }),
      new Paragraph({ text: `Economia anual estimada: ${formatarMoeda(economiaAnualTotal)}` }),
      new Paragraph({
        children: [new TextRun({ text: `Payback estimado: ${formatarNumero(paybackMeses, 1)} meses`, bold: true, color: COR_ACCENT, size: 26 })],
        spacing: { after: 100 },
      })
    );
  }
  if (somenteMaoObra && paybackDias != null) {
    children.push(
      titulo3("Retorno do Investimento em Mão de Obra", 300),
      new Paragraph({ text: `Investimento em mão de obra: ${formatarMoeda(orcamento.valor_final)}` }),
      new Paragraph({ text: `Economia anual estimada: ${formatarMoeda(economiaAnualTotal)}` }),
      new Paragraph({
        children: [new TextRun({ text: `Payback estimado: ${paybackDias} dias`, bold: true, color: COR_ACCENT, size: 26 })],
        spacing: { after: 100 },
      })
    );
  }

  if (projecaoDezAnos.length > 0) {
    children.push(
      new Paragraph({ text: `${n++}. Projeção de Economia Acumulada (10 anos)`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
      new Paragraph({
        text:
          reajuste > 0
            ? `Projeção com reajuste tarifário estimado de ${formatarNumero(reajuste, 1)}% ao ano — estimativa de mercado, não uma garantia contratual.`
            : "Projeção com economia anual constante (sem reajuste tarifário assumido).",
        spacing: { after: 100 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          linhaCabecalho(["Ano", "Economia do ano", "Acumulado"]),
          ...projecaoDezAnos.map(
            (linha) => new TableRow({ children: [celula(String(linha.ano)), celula(formatarMoeda(linha.economiaDoAno)), celula(formatarMoeda(linha.acumulado))] })
          ),
        ],
      })
    );
  }

  if (economiaAnualTotal > 0 || co2ToneladasAno > 0) {
    children.push(new Paragraph({ text: `${n++}. Benefícios Ambientais`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }));
    if (economiaAnualTotal > 0) children.push(paragrafoItem(`Economia anual estimada de energia: ${formatarMoeda(economiaAnualTotal)}`));
    if (co2ToneladasAno > 0) children.push(paragrafoItem(`Redução de emissão de CO₂: ${formatarNumero(co2ToneladasAno, 2)} toneladas/ano`));
    if (arvores > 0) children.push(paragrafoItem(`Equivalência ilustrativa: cerca de ${arvores} árvores plantadas por ano`));
  }

  children.push(new Paragraph({ text: `${n++}. Condições Comerciais`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }));
  children.push(titulo3("Forma de pagamento"));
  children.push(
    paragrafoItem(`À vista: ${formatarNumero(descontoAvista, 0)}% de desconto`),
    paragrafoItem(formaPagamentoPadrao),
    paragrafoItem("Parcelado: consulte condições")
  );
  children.push(titulo3("Prazo de execução e validade"));
  children.push(
    new Paragraph({
      text:
        (prazoDias != null
          ? `${prazoDias} dia(s) útil(eis), estimado(s) a partir da mão de obra calculada para esta proposta.`
          : "A confirmar após aceite.") + ` Proposta válida por ${validadeDias} dias a partir da emissão.`,
    })
  );
  children.push(titulo3("Garantias"));
  children.push(paragrafoItem(`Mão de obra: ${garantiaMeses} meses`), paragrafoItem("Materiais: conforme garantia do fabricante"));
  children.push(titulo3("Responsabilidades — BR Isolamentos"));
  children.push(
    paragrafoItem("Execução conforme especificações técnicas desta proposta"),
    paragrafoItem("Equipe especializada e qualificada"),
    ...(!somenteMaoObra ? [paragrafoItem("Materiais conforme escopo aprovado")] : []),
    paragrafoItem(`Garantia de mão de obra (${garantiaMeses} meses)`),
    paragrafoItem("EPI da própria equipe"),
    paragrafoItem("Limpeza da área de trabalho após a execução"),
    paragrafoItem("Cumprimento das normas de segurança aplicáveis (NRs)")
  );
  children.push(titulo3("Responsabilidades — Cliente"));
  children.push(
    paragrafoItem("Acesso seguro ao local de trabalho"),
    paragrafoItem("Liberação de segurança conforme protocolos internos"),
    paragrafoItem("Energia e água disponíveis quando necessário"),
    paragrafoItem("Área para estocagem de materiais, quando aplicável"),
    paragrafoItem("Estrutura de apoio para trabalho em altura, quando aplicável"),
    paragrafoItem("Comunicação de mudanças de cronograma com antecedência"),
    paragrafoItem("Coordenação de paradas de equipamento, quando necessário")
  );
  children.push(titulo3("Não contemplado nesta proposta"));
  children.push(paragrafoItem("Modificações de escopo não descritas nesta proposta"), ...naoContempla.map(paragrafoItem));

  if (orcamento.observacoes_adicionais) {
    children.push(
      new Paragraph({ text: `${n++}. Observações Adicionais`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
      new Paragraph({ text: orcamento.observacoes_adicionais })
    );
  }

  children.push(
    new Paragraph({ text: `${n++}. Próximos Passos`, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
    paragrafoItem("Aprovação desta proposta comercial"),
    paragrafoItem("Agendamento de mobilização"),
    paragrafoItem("Execução dos trabalhos no prazo estimado"),
    paragrafoItem("Comissionamento e conferência final")
  );

  children.push(
    new Paragraph({
      text: "Cálculos de economia baseados nos parâmetros informados no momento da elaboração — alterações tarifárias podem alterar os valores estimados.",
      spacing: { before: 200 },
    }),
    new Paragraph({
      text: `Contato: ${[configEmpresa?.telefone_empresa, configEmpresa?.email_empresa].filter(Boolean).join(" · ") || "—"}`,
      spacing: { after: 300 },
    }),
    new Paragraph({ text: `Mogi das Cruzes, SP — ${formatarData(new Date().toISOString())}` })
  );

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

export function nomeArquivoDocxComercial(orcamento: Orcamento): string {
  return `Proposta_Comercial_${orcamento.numero}.docx`;
}

/** Mesmo conteúdo/seções da Proposta Técnica em PDF
 * (components/pdf-native/PropostaTecnicaDocument.tsx) — sem as imagens de
 * referência (ver decisão no topo do arquivo) e sem valores comerciais
 * (isso é papel da Proposta Comercial). */
export async function gerarPropostaTecnicaDocx(orcamento: Orcamento, configEmpresa?: ConfigEmpresa | null): Promise<Blob> {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
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
  const contempla = itensContemplados(orcamento.tipo_proposta);
  const naoContempla = itensNaoContemplados(orcamento.tipo_proposta);

  const children: Array<Paragraph | Table> = [];

  children.push(
    ...blocoCapa("Técnica", orcamento, `${LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho} · ${orcamento.numero}`)
  );

  children.push(
    new Paragraph({ text: "1. Por que isolar termicamente", heading: HeadingLevel.HEADING_2, pageBreakBefore: true }),
    new Paragraph({
      text: "O isolamento térmico fixo reduz a troca de calor entre uma superfície (tubulação, equipamento ou envoltória) e o ambiente, trazendo ganhos diretos em quatro frentes: eficiência energética (menos combustível ou energia elétrica para manter a temperatura de processo), segurança (redução da temperatura de superfícies acessíveis, evitando queimaduras), controle de processo (temperaturas mais estáveis) e, em sistemas frios, prevenção de condensação e da corrosão e proliferação de mofo que ela causa ao longo do tempo.",
      spacing: { after: 200 },
    })
  );

  let numeroSecao = 2;

  children.push(
    new Paragraph({ text: `${numeroSecao++}. Princípios físicos aplicados`, heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      text: "O dimensionamento de cada trecho considera os três mecanismos de transferência de calor atuando em série: condução através da espessura do isolante (regida pela condutividade térmica k do material, que varia com a temperatura), e convecção (natural ou forçada pelo vento) somada à radiação na face externa, trocando calor com o ambiente. O ponto de equilíbrio entre esses mecanismos — a temperatura da face fria do isolamento — é encontrado por método iterativo, seguindo as práticas recomendadas pelas normas ASTM C680 e ISO 12241, em conformidade com a ABNT NBR 16281.",
      spacing: { after: 200 },
    })
  );

  if (itensQuentes.length > 0) {
    children.push(
      new Paragraph({ text: `${numeroSecao++}. Eficiência energética e redução de carbono`, heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: "Em sistemas quentes, cada grau de temperatura perdido pela superfície para o ambiente representa energia comprada e não aproveitada no processo. Isolar reduz essa perda, o que se traduz em menor consumo de combustível ou eletricidade, menor custo operacional recorrente e menor emissão de CO₂ associada à queima desse combustível.",
        spacing: { after: 150 },
      })
    );
    for (const item of itensQuentes) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: descricaoMaterialCompleta(item), bold: true })] }),
        new Paragraph({ text: `Perda de calor sem isolante: ${formatarNumero(item.perda_sem_isolante, 3)} kW/m²` }),
        new Paragraph({ text: `Perda de calor com isolante: ${formatarNumero(item.perda_com_isolante, 3)} kW/m²` }),
        new Paragraph({ text: `Subtotal do trecho: ${formatarNumero(item.perda_com_isolante * item.area_m2, 2)} kW em ${formatarNumero(item.area_m2)} m²` })
      );
      if (item.economia_anual != null) children.push(new Paragraph({ text: `Economia anual estimada: ${formatarMoeda(item.economia_anual)}` }));
      if (item.co2_ton_ano != null)
        children.push(new Paragraph({ text: `CO₂ evitado por ano: ${formatarNumero(item.co2_ton_ano, 2)} toneladas`, spacing: { after: 150 } }));
    }
  }

  if (itensFrios.length > 0) {
    children.push(
      new Paragraph({ text: `${numeroSecao++}. Prevenção de condensação`, heading: HeadingLevel.HEADING_2 }),
      new Paragraph({
        text: "Em sistemas frios, quando a temperatura da superfície isolada fica abaixo do ponto de orvalho do ar ambiente, o vapor de água presente no ar condensa sobre ela — causando corrosão sob isolamento, formação de mofo e gotejamento. A espessura mínima de cada trecho é calculada (fórmula de Magnus para o ponto de orvalho, combinada com o mesmo método iterativo de equilíbrio térmico) para manter a face fria do isolamento sempre acima dessa temperatura crítica.",
        spacing: { after: 150 },
      })
    );
    for (const item of itensFrios) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: descricaoMaterialCompleta(item), bold: true })] }),
        new Paragraph({ text: `Espessura mínima recomendada: ${formatarNumero(item.espessura_necessaria_mm, 1)} mm`, spacing: { after: 150 } })
      );
    }
    children.push(
      new Paragraph({
        text: "⚠ Variação estimada de ±5%: os cálculos de perda térmica no lado frio dependem de condições operacionais e de propriedades dos materiais isolantes em campo, que podem variar em relação ao projetado — a espessura especificada já incorpora essa margem de segurança.",
        spacing: { after: 150 },
      })
    );
  }

  children.push(new Paragraph({ text: `${numeroSecao++}. Escopo contemplado`, heading: HeadingLevel.HEADING_2 }));
  itens.forEach((item, index) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Trecho ${index + 1} (${LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho})${item.trabalho_altura ? " · trabalho em altura" : ""}`,
            bold: true,
          }),
        ],
      })
    );
    if ((item.escopo_itens?.length ?? 0) > 0) {
      for (const escopo of item.escopo_itens) children.push(new Paragraph({ text: `• ${escopo.nome}` }));
    } else {
      children.push(new Paragraph({ text: `${formatarNumero(item.area_m2)} m²` }));
    }
  });
  children.push(titulo3("✅ O orçamento contempla"), ...contempla.map(paragrafoItem));
  children.push(titulo3("❌ Não contemplado"), ...naoContempla.map(paragrafoItem));

  children.push(new Paragraph({ text: `${numeroSecao++}. Especificação técnica por trecho`, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  const linhasEspecificacao = itens.map(
    (item, index) =>
      new TableRow({
        children: [
          celula(`${index + 1} (${LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho})`),
          celula(descricaoMaterialCompleta(item)),
          celula(item.geometria === "tubulacao" ? "Tubulação" : "Sup. plana"),
          celula(`${formatarNumero(item.area_m2)} m²`),
        ],
      })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [linhaCabecalho(["Trecho", "Material", "Geometria", "Área"]), ...linhasEspecificacao],
    })
  );

  children.push(new Paragraph({ text: `${numeroSecao++}. Parâmetros de cálculo`, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  const linhasParametros = itens.map(
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
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [linhaCabecalho(["Trecho", "T. interna", "T. ambiente", "Vento", "Umidade", "Altura"]), ...linhasParametros],
    })
  );

  children.push(new Paragraph({ text: `${numeroSecao++}. Metodologia e padrões técnicos`, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Normas de referência: ", bold: true }),
        new TextRun({
          text: "ASTM C680 (cálculo de transferência de calor em superfícies isoladas), ISO 12241 (isolamento térmico de equipamentos e sistemas industriais) e ABNT NBR 16281 (isolamento térmico — terminologia).",
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Método de cálculo: ", bold: true }),
        new TextRun({
          text: 'resolução iterativa do equilíbrio entre condução (através do isolante), convecção (natural ou forçada) e radiação na face externa — ver seção 2, "Princípios físicos aplicados".',
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Condições consideradas: ", bold: true }),
        new TextRun({
          text: "temperaturas de processo/ambiente, velocidade do vento e (em sistemas frios) umidade relativa informados para cada trecho — ver tabela de parâmetros de cálculo acima.",
        }),
      ],
    })
  );

  children.push(new Paragraph({ text: `${numeroSecao++}. Conclusões e recomendações`, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
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
      text: "Recomenda-se a execução de todos os trechos contemplados nesta proposta para maximizar os benefícios de eficiência, segurança e/ou prevenção descritos acima. Após a aprovação técnica, a Proposta Comercial detalha investimento, prazo de execução e condições de pagamento.",
      spacing: { before: 100, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      text: `Proposta técnica sem valores comerciais — consulte a Proposta Comercial para o investimento. Orçamento válido por ${validadeDias} dias. Cálculos conforme normas ASTM C680, ISO 12241 e ABNT NBR 16281.`,
    }),
    new Paragraph({
      text: `Contato: ${[configEmpresa?.telefone_empresa, configEmpresa?.email_empresa].filter(Boolean).join(" · ") || "—"}`,
    })
  );

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}

export function nomeArquivoDocxTecnica(orcamento: Orcamento): string {
  return `Proposta_Tecnica_${orcamento.numero}.docx`;
}
