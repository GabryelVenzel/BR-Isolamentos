// Geração das Propostas Técnica e Comercial em Word (.docx) — mesma
// informação das versões em PDF nativo (components/pdf-native/*.tsx),
// construída direto com a lib `docx` em vez de capturar um elemento HTML
// (jsPDF/html2canvas só produzem imagem, não um .docx editável de verdade).
// A versão Word NÃO inclui as imagens de referência (só o PDF embute imagem
// via @react-pdf/renderer sem round-trip de rede extra) — quem precisar
// delas usa o PDF.
//
// Estrutura elaborada (pedido "PROPOSTAS TÉCNICA E COMERCIAL ELABORADAS") —
// ver a decisão de arquitetura no topo de components/pdf-native/
// PropostaComercialDocument.tsx: mesmo template para as "6 variações"
// (Material+MO/Somente MO × Quente/Frio/Mista), os cálculos de apoio
// (payback, projeção, equivalência ambiental, prazo) vêm de
// lib/usecases/orcamento/analiseProposta.ts — a MESMA função usada pelo PDF,
// pra as duas versões nunca divergirem numericamente.

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { formatarData, formatarMoeda, formatarNumero } from "./format";
import {
  arvoresEquivalentes,
  calcularBeneficiosConsolidados,
  calcularPaybackDias,
  calcularPaybackMeses,
  prazoExecucaoDiasUteis,
  projetarEconomiaAcumulada,
  temAnaliseFinanceira,
} from "./usecases/orcamento";
import type { ConfigEmpresa, Orcamento } from "./types";

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };
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

function titulo2(texto: string, before = 300): Paragraph {
  return new Paragraph({ text: texto, heading: HeadingLevel.HEADING_2, spacing: { before } });
}

function titulo3(texto: string, before = 150): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: texto, bold: true })],
    spacing: { before, after: 60 },
  });
}

export async function gerarPropostaComercialDocx(orcamento: Orcamento, configEmpresa?: ConfigEmpresa | null): Promise<Blob> {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const somenteMaoObra = orcamento.tipo_proposta === "somente_mo";
  const totalHoras = itens.reduce((acc, i) => acc + (i.horas_mao_obra ?? 0), 0);
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
      children: [new TextRun({ text: "Proposta Comercial de Isolamento Térmico", size: 24 })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho} · ${somenteMaoObra ? "Somente Mão de Obra" : "Material + Mão de Obra"} · ${orcamento.numero} · ${formatarData(orcamento.data_criacao)}`,
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

  children.push(titulo2("Especificações Técnicas"));
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

  // Quantificação de materiais e mão de obra (ou só mão de obra, em
  // "somente_mo") — mesma lógica de fallback do PDF: usa o detalhamento por
  // material persistido desde a migração 020 quando disponível.
  if (somenteMaoObra) {
    children.push(
      titulo2("Quantificação de Mão de Obra"),
      new Paragraph({
        text: 'Proposta "Somente Mão de Obra" — o material é fornecido pelo cliente e não entra neste investimento.',
        spacing: { after: 100 },
      })
    );
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          linhaCabecalho(["Trecho", "Horas", "Valor/hora", "Subtotal"]),
          ...itens.map(
            (item, index) =>
              new TableRow({
                children: [
                  celula(`Trecho ${index + 1} (${LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho})`),
                  celula(`${formatarNumero(item.horas_mao_obra ?? 0, 1)} h`),
                  celula(formatarMoeda(item.horas_mao_obra > 0 ? item.subtotal_mao_obra / item.horas_mao_obra : 0)),
                  celula(formatarMoeda(item.subtotal_mao_obra)),
                ],
              })
          ),
        ],
      })
    );
  } else if (temDetalhamentoNovo) {
    children.push(titulo2("Quantificação de Materiais e Mão de Obra"));
    for (const [index, item] of itens.entries()) {
      if ((item.detalhamento_materiais?.length ?? 0) === 0 && item.horas_mao_obra <= 0) continue;
      if (itens.length > 1) children.push(titulo3(`Trecho ${index + 1} — ${item.material}`));
      const linhasMateriais = item.detalhamento_materiais.map(
        (linha) =>
          new TableRow({
            children: [
              celula(linha.titulo),
              celula(`${formatarNumero(linha.quantidade, linha.unidade === "g" ? 1 : 2)} ${linha.unidade}`),
              celula(formatarMoeda(linha.preco_unitario)),
              celula(formatarMoeda(linha.subtotal)),
            ],
          })
      );
      if (item.horas_mao_obra > 0) {
        linhasMateriais.push(
          new TableRow({
            children: [
              celula("Mão de obra (dupla)"),
              celula(`${formatarNumero(item.horas_mao_obra, 1)} h`),
              celula(formatarMoeda(item.subtotal_mao_obra / item.horas_mao_obra)),
              celula(formatarMoeda(item.subtotal_mao_obra)),
            ],
          })
        );
      }
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [linhaCabecalho(["Item", "Qtd.", "Preço unit.", "Subtotal"]), ...linhasMateriais],
        })
      );
    }
    children.push(
      new Paragraph({ text: `Subtotal Materiais: ${formatarMoeda(orcamento.valor_materiais)}`, spacing: { before: 100 } }),
      new Paragraph({ text: `Subtotal Mão de Obra (${formatarNumero(totalHoras, 1)}h): ${formatarMoeda(orcamento.valor_mao_obra)}` })
    );
  }

  if (orcamento.valor_deslocamento > 0 || orcamento.valor_hospedagem > 0 || orcamento.valor_frete > 0) {
    children.push(titulo2("Custos Operacionais"));
    if (orcamento.valor_deslocamento > 0) children.push(new Paragraph({ text: `Deslocamento: ${formatarMoeda(orcamento.valor_deslocamento)}` }));
    if (orcamento.valor_hospedagem > 0) children.push(new Paragraph({ text: `Hospedagem: ${formatarMoeda(orcamento.valor_hospedagem)}` }));
    if (orcamento.valor_frete > 0) children.push(new Paragraph({ text: `Frete: ${formatarMoeda(orcamento.valor_frete)}` }));
  }

  children.push(titulo2("Resumo Financeiro"));
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
      children: [celula("VALOR TOTAL", { negrito: true }), celula(formatarMoeda(orcamento.valor_final), { negrito: true, cor: COR_ACCENT })],
    })
  );
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: linhasFinanceiro }));

  // Análise de payback/ROI — mesmos cálculos usados no PDF
  // (lib/usecases/orcamento/analiseProposta.ts), nunca duplicados/recalculados
  // com fórmula própria aqui.
  if (!somenteMaoObra && paybackMeses != null) {
    children.push(
      titulo2("Análise de Retorno do Investimento"),
      new Paragraph({ children: [new TextRun({ text: `Investimento: ${formatarMoeda(orcamento.valor_final)}`, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: `Economia anual estimada: ${formatarMoeda(economiaAnualTotal)}`, bold: true })] }),
      new Paragraph({
        children: [new TextRun({ text: `Payback estimado: ${formatarNumero(paybackMeses, 1)} meses`, bold: true, color: COR_ACCENT, size: 26 })],
        spacing: { after: 100 },
      }),
      new Paragraph({
        text: "Estimativa com base na economia de energia calculada para os trechos quentes desta proposta. Considera o valor investido total, sem reajuste tarifário.",
        spacing: { after: 200 },
      })
    );
  }
  if (somenteMaoObra && paybackDias != null) {
    children.push(
      titulo2("Retorno do Investimento em Mão de Obra"),
      new Paragraph({ children: [new TextRun({ text: `Investimento em mão de obra: ${formatarMoeda(orcamento.valor_final)}`, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: `Economia anual estimada: ${formatarMoeda(economiaAnualTotal)}`, bold: true })] }),
      new Paragraph({
        children: [new TextRun({ text: `Payback estimado: ${paybackDias} dias`, bold: true, color: COR_ACCENT, size: 26 })],
        spacing: { after: 200 },
      })
    );
  }

  if (projecaoDezAnos.length > 0) {
    children.push(
      titulo2("Projeção de Economia Acumulada (10 anos)"),
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
            (linha) =>
              new TableRow({
                children: [celula(String(linha.ano)), celula(formatarMoeda(linha.economiaDoAno)), celula(formatarMoeda(linha.acumulado))],
              })
          ),
        ],
      })
    );
  }

  if (economiaAnualTotal > 0 || co2ToneladasAno > 0) {
    children.push(titulo2("Benefícios Ambientais"));
    if (economiaAnualTotal > 0) children.push(paragrafoItem(`Economia anual estimada de energia: ${formatarMoeda(economiaAnualTotal)}`));
    if (co2ToneladasAno > 0) children.push(paragrafoItem(`Redução de emissão de CO₂: ${formatarNumero(co2ToneladasAno, 2)} toneladas/ano`));
    if (arvores > 0) children.push(paragrafoItem(`Equivalência ilustrativa: cerca de ${arvores} árvores plantadas por ano`));
    children.push(
      new Paragraph({
        text: "Equivalência de árvores é uma estimativa ilustrativa (fator configurável), não uma métrica de compensação de carbono certificada.",
        spacing: { after: 200 },
      })
    );
  }

  children.push(titulo2("Condições Comerciais"));
  children.push(titulo3("Forma de pagamento"));
  children.push(
    paragrafoItem(`À vista: ${formatarNumero(descontoAvista, 0)}% de desconto`),
    paragrafoItem("50% de entrada + 50% na conclusão dos trabalhos"),
    paragrafoItem("Parcelado: consulte condições")
  );
  children.push(titulo3("Prazo de execução"));
  children.push(
    new Paragraph({
      text:
        (prazoDias != null
          ? `${prazoDias} dia(s) útil(eis), estimado(s) a partir da mão de obra calculada para esta proposta.`
          : "A confirmar após aceite.") + " Data de início a combinar com o cliente.",
    })
  );
  children.push(titulo3("Garantias"));
  children.push(paragrafoItem(`Mão de obra: ${garantiaMeses} meses`), paragrafoItem("Materiais: conforme garantia do fabricante"));
  children.push(titulo3("Responsabilidades"));
  children.push(
    paragrafoItem(
      `BR Isolamentos: ${somenteMaoObra ? "mão de obra especializada e execução conforme normas técnicas" : "fornecimento de materiais, mão de obra especializada e execução conforme normas técnicas"}`
    ),
    paragrafoItem("Cliente: acesso seguro ao local, estrutura de apoio para trabalho em altura quando aplicável, segurança no canteiro de obras")
  );
  children.push(titulo3("Não contemplado nesta proposta"));
  children.push(
    paragrafoItem("Modificações de escopo não descritas nesta proposta"),
    paragrafoItem("Estruturas de acesso para trabalho em altura (andaimes/plataformas), salvo se explicitamente incluídas"),
    paragrafoItem("Adequações civis/estruturais e remoção de isolamento antigo, salvo se explicitamente incluídas")
  );

  children.push(
    titulo2("Próximos Passos"),
    paragrafoItem("Aprovação desta proposta comercial"),
    paragrafoItem("Agendamento de mobilização"),
    paragrafoItem("Execução dos trabalhos no prazo estimado"),
    paragrafoItem("Comissionamento e conferência final")
  );

  children.push(
    new Paragraph({
      text: "Validade da proposta: 30 dias. Proposta sujeita a alterações por motivos climáticos, de acesso ao local ou força maior.",
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

  const reducoes = itensQuentes
    .filter((i) => i.perda_sem_isolante > 0)
    .map((i) => ((i.perda_sem_isolante - i.perda_com_isolante) / i.perda_sem_isolante) * 100);
  const reducaoMin = reducoes.length > 0 ? Math.min(...reducoes) : null;
  const reducaoMax = reducoes.length > 0 ? Math.max(...reducoes) : null;
  const maiorFaceFria = itensQuentes.reduce((max, i) => (i.temperatura_face_fria != null ? Math.max(max, i.temperatura_face_fria) : max), -Infinity);

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
      spacing: { after: 100 },
    })
  );

  if (orcamento.cliente?.nome) {
    const local = [orcamento.cliente.cidade, orcamento.cliente.estado].filter(Boolean).join(" - ");
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${orcamento.cliente.nome}${local ? ` — ${local}` : ""}`, bold: true })],
        spacing: { after: 300 },
      })
    );
  }

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
      text: "Proposta técnica sem valores comerciais — consulte a Proposta Comercial para o investimento. Orçamento válido por 30 dias. Cálculos conforme normas ASTM C680, ISO 12241 e ABNT NBR 16281.",
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
