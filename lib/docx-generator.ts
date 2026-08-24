// Geração da Proposta Comercial em Word (.docx) — mesma informação da
// Proposta Comercial em PDF (components/PDFPreviewComercial.tsx), construída
// direto com a lib `docx` em vez de capturar um elemento HTML (jsPDF/
// html2canvas só produzem imagem, não um .docx editável de verdade).
//
// Só a Proposta COMERCIAL tem versão Word — a Proposta TÉCNICA (texto
// conceitual longo, sem valores) continua só em PDF: é o documento
// secundário/opcional, enquanto a Comercial é o que de fato vai pro cliente
// assinar, e duplicar toda a formatação condicional entre dois motores de
// documento (HTML→PDF e docx.js) para as duas propostas dobraria a
// superfície de manutenção para um ganho pequeno.

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
