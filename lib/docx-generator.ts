// Geração da Proposta Comercial em Word (.docx) — mesma informação da
// Proposta Comercial em PDF (components/PDFPreviewComercial.tsx), construída
// direto com a lib `docx` em vez de capturar um elemento HTML (jsPDF/
// html2canvas só produzem imagem, não um .docx editável de verdade).
//
// A Proposta TÉCNICA também ganhou versão Word (pedido explícito, revisão
// desta decisão original — abaixo o texto de quando só a Comercial tinha
// Word: "a Técnica é texto conceitual longo, sem valores, documento
// secundário". Isso ficou desatualizado depois que a Técnica em PDF (ver
// components/pdf-native/PropostaTecnicaDocument.tsx) passou a incluir tabela
// de especificação por trecho e blocos de economia/CO₂ — não é mais só
// texto corrido). A versão Word da Técnica NÃO inclui as imagens de
// referência (só o PDF embute imagem via @react-pdf/renderer sem round-trip
// de rede extra) — quem precisar delas usa o PDF.

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { formatarData, formatarMoeda, formatarNumero } from "./format";
import type { ConfigEmpresa, Orcamento } from "./types";

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };
const COR_MARCA = "060035";

function celula(texto: string, opts: { negrito?: boolean; cor?: string } = {}): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold: opts.negrito, color: opts.cor })] })],
  });
}

function linhaCabecalho(colunas: string[]): TableRow {
  return new TableRow({ children: colunas.map((c) => celula(c, { negrito: true, cor: "FFFFFF" })) });
}

export async function gerarPropostaComercialDocx(orcamento: Orcamento, configEmpresa?: ConfigEmpresa | null): Promise<Blob> {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);

  // Corpo do documento montado como uma única lista sequencial (parágrafos e
  // tabelas intercalados, na ordem em que aparecem no papel) — mais simples
  // e menos propenso a erro do que remontar pedaços depois.
  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "BR ISOLAMENTOS", bold: true, size: 32, color: COR_MARCA })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Proposta Técnica Comercial de Isolamento Térmico", size: 24 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho} · ${orcamento.numero} · ${formatarData(orcamento.data_criacao)}`,
          italics: true,
        }),
      ],
      spacing: { after: 300 },
    }),

    new Paragraph({ text: "Cliente", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ text: orcamento.cliente?.nome ?? "—" })
  );

  if (orcamento.cliente?.cnpj_cpf) children.push(new Paragraph({ text: orcamento.cliente.cnpj_cpf }));
  if (orcamento.cliente?.endereco) children.push(new Paragraph({ text: orcamento.cliente.endereco }));

  children.push(new Paragraph({ text: "Especificações Técnicas", heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }));

  const linhasEspecificacoes = itens.map(
    (item, index) =>
      new TableRow({
        children: [
          celula(String(index + 1)),
          celula(item.material),
          celula(LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho),
          celula(`${formatarNumero(item.area_m2)} m²`),
          celula(`${formatarNumero(item.espessura_necessaria_mm, 1)} mm`),
        ],
      })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [linhaCabecalho(["Trecho", "Material", "Tipo", "Área", "Espessura"]), ...linhasEspecificacoes],
    })
  );

  children.push(new Paragraph({ text: "Resumo Financeiro", heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }));

  const linhasFinanceiro: TableRow[] = [
    new TableRow({ children: [celula("Subtotal (materiais + serviços)"), celula(formatarMoeda(orcamento.subtotal))] }),
    ...(orcamento.detalhamento_impostos ?? []).map(
      (imposto) =>
        new TableRow({
          children: [celula(`(+) ${imposto.nome} (${imposto.percentual.toFixed(2)}%)`), celula(formatarMoeda(imposto.valor))],
        })
    ),
    new TableRow({ children: [celula("(+) Margem de lucro"), celula(formatarMoeda(orcamento.margem_lucro))] }),
  ];
  if (orcamento.valor_desconto > 0) {
    linhasFinanceiro.push(
      new TableRow({ children: [celula("(-) Desconto comercial"), celula(`- ${formatarMoeda(orcamento.valor_desconto)}`)] })
    );
  }
  linhasFinanceiro.push(
    new TableRow({
      children: [celula("VALOR TOTAL", { negrito: true }), celula(formatarMoeda(orcamento.valor_final), { negrito: true, cor: "078B41" })],
    })
  );

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: linhasFinanceiro }));

  children.push(
    new Paragraph({ text: "Observações", heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
    new Paragraph({ text: "Validade da proposta: 30 dias." }),
    new Paragraph({ text: "Forma de pagamento: a negociar." }),
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

/** Mesmo conteúdo textual/tabelas da Proposta Técnica em PDF
 * (components/pdf-native/PropostaTecnicaDocument.tsx) — sem as imagens de
 * referência (ver decisão no topo do arquivo) e sem valores comerciais
 * (isso é papel da Proposta Comercial). */
export async function gerarPropostaTecnicaDocx(orcamento: Orcamento, configEmpresa?: ConfigEmpresa | null): Promise<Blob> {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const itensQuentes = itens.filter((i) => i.tipo_trabalho === "quente");
  const itensFrios = itens.filter((i) => i.tipo_trabalho === "frio");

  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "BR ISOLAMENTOS", bold: true, size: 32, color: COR_MARCA })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Proposta Técnica de Isolamento Térmico", size: 24 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho} · ${orcamento.numero} · ${formatarData(orcamento.data_criacao)}`,
          italics: true,
        }),
      ],
      spacing: { after: 300 },
    })
  );

  children.push(
    new Paragraph({ text: "1. Por que isolar termicamente", heading: HeadingLevel.HEADING_2 }),
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
        new Paragraph({ children: [new TextRun({ text: `${item.material}${item.acabamento ? ` · ${item.acabamento}` : ""}`, bold: true })] }),
        new Paragraph({ text: `Perda de calor sem isolante: ${formatarNumero(item.perda_sem_isolante, 3)} kW/m²` }),
        new Paragraph({ text: `Perda de calor com isolante: ${formatarNumero(item.perda_com_isolante, 3)} kW/m²` })
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
        new Paragraph({ children: [new TextRun({ text: item.material, bold: true })] }),
        new Paragraph({ text: `Espessura mínima recomendada: ${formatarNumero(item.espessura_necessaria_mm, 1)} mm`, spacing: { after: 150 } })
      );
    }
  }

  children.push(new Paragraph({ text: `${numeroSecao++}. Escopo contemplado`, heading: HeadingLevel.HEADING_2 }));
  itens.forEach((item, index) => {
    children.push(
      new Paragraph({ children: [new TextRun({ text: `Trecho ${index + 1} (${LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho})`, bold: true })] })
    );
    if ((item.escopo_itens?.length ?? 0) > 0) {
      for (const escopo of item.escopo_itens) children.push(new Paragraph({ text: `• ${escopo.nome}` }));
    } else {
      children.push(new Paragraph({ text: `${formatarNumero(item.area_m2)} m²` }));
    }
  });

  children.push(new Paragraph({ text: `${numeroSecao++}. Especificação técnica por trecho`, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  const linhasEspecificacao = itens.map(
    (item, index) =>
      new TableRow({
        children: [
          celula(`${index + 1} (${LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho})`),
          celula(item.material),
          celula(item.geometria === "tubulacao" ? "Tubulação" : "Sup. plana"),
          celula(`${formatarNumero(item.area_m2)} m²`),
          celula(`${formatarNumero(item.espessura_necessaria_mm, 1)} mm`),
        ],
      })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [linhaCabecalho(["Trecho", "Material", "Geometria", "Área", "Espessura"]), ...linhasEspecificacao],
    })
  );

  children.push(
    new Paragraph({
      text: "Proposta técnica sem valores comerciais — consulte a Proposta Comercial para o investimento. Orçamento válido por 30 dias. Cálculos conforme normas ASTM C680, ISO 12241 e ABNT NBR 16281.",
      spacing: { before: 300 },
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
