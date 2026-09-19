// Gera o relatório Word (papel timbrado BR) a partir de resultados_<tag>.json
// uso: node gerar-relatorio.js DN8|D500
const fs = require("fs");
const path = require("path");
const D = require("docx");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header, Footer,
  AlignmentType, WidthType, ShadingType, BorderStyle, LevelFormat, PageNumber, HeadingLevel,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, VerticalAlign, TabStopType,
} = D;

const tag = process.argv[2] || "DN8";
const SKIP = (process.env.SKIP || "").split(",");
const R = require(`./resultados_${tag}.json`);
const M = require("./modelo.js");
const ROOT = path.join(__dirname, "..");
const OUT = process.env.OUTFILE || path.join(ROOT, tag === "DN8"
  ? "Cargill_Estudo_Simplificado_Isolamento_Linhas_1e2_DN8.docx"
  : "Cargill_Estudo_Simplificado_Isolamento_Linhas_1e2_D500.docx");

// ---------- identidade visual ----------
const NAVY = "060035", GREEN = "078B41", YELLOW = "FBC819", AMBER = "8A6A00", GRAYT = "5B6070", LIGHT = "ECEAF4", GLIGHT = "E5F4EA", YLIGHT = "FEF6DB", RLIGHT = "FBE9EA", RED = "B3261E";
const FONT = "Arial";
const CONTENT_W = 9029; // A4 (11909) - margens 1440 x 2

// ---------- dados ----------
const diamMm = tag === "DN8" ? 219.1 : 500;
const diamTxt = tag === "DN8" ? "Ø 8″ (219,1 mm)" : "Ø 500 mm";
const c50 = R.cenarios["50"], c75 = R.cenarios["75"], c100 = R.cenarios["100"];
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const fmt = (v, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt0 = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const sgn = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), d);
const perdaAtual = sum(c50, (x) => x.atual.perdaKW);
const tot = (c, f) => sum(c, f);
const t50 = { perda: tot(c50, (x) => x.novo.perdaKW), m3: tot(c50, (x) => x.fin.m3Ano), kwh: tot(c50, (x) => x.fin.kwhAno), co2: tot(c50, (x) => x.fin.co2TonAno) };
const t75 = { perda: tot(c75, (x) => x.novo.perdaKW), m3: tot(c75, (x) => x.fin.m3Ano), kwh: tot(c75, (x) => x.fin.kwhAno), co2: tot(c75, (x) => x.fin.co2TonAno) };
const t100 = { perda: tot(c100, (x) => x.novo.perdaKW), m3: tot(c100, (x) => x.fin.m3Ano), kwh: tot(c100, (x) => x.fin.kwhAno), co2: tot(c100, (x) => x.fin.co2TonAno) };
const pct = (novo) => ((novo - perdaAtual) / perdaAtual) * 100;
const eqMm = (() => {
  const g = R.grade;
  for (let k = 0; k < g.length - 1; k++) {
    const d0 = g[k].linhas[0].dTnovo - g[k].linhas[0].dTatual, d1 = g[k + 1].linhas[0].dTnovo - g[k + 1].linhas[0].dTatual;
    if (d0 >= 0 && d1 <= 0) return g[k].esp + (10 * d0) / (d0 - d1);
  }
  return 60;
})();
const tsMax50 = Math.max(...c50.map((x) => x.novo.tsMax)), tsMax100 = Math.max(...c100.map((x) => x.novo.tsMax));
const nm3h = c50.map((x) => x.nm3h), vel = c50.map((x) => x.vel);

// ---------- helpers ----------
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics, color: o.color, ...(o.extra || {}) });
const para = (children, o = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [run(children, o)],
    alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? 276 },
    keepNext: o.keepNext, keepLines: o.keepLines, indent: o.indent, border: o.border, shading: o.shading,
  });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text: t, font: FONT })], spacing: { before: 280, after: 120 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GREEN, space: 3 } } });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: t, font: FONT })], spacing: { before: 180, after: 80 } });
const bullet = (children, o = {}) =>
  new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: o.after ?? 70, line: 276 }, children: Array.isArray(children) ? children : [run(children)] });
const rich = (parts) => parts.map((p) => (typeof p === "string" ? run(p) : run(p.t, p)));

const border = { style: BorderStyle.SINGLE, size: 4, color: "C9CBD6" };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(content, w, o = {}) {
  const kids = (Array.isArray(content) ? content : [content]).map((c) =>
    typeof c === "string"
      ? new Paragraph({ alignment: o.align ?? AlignmentType.LEFT, keepNext: o.keepNext, spacing: { before: 30, after: 30 }, children: [run(c, { size: o.size ?? 18, bold: o.bold, color: o.color })] })
      : c
  );
  return new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER, columnSpan: o.span,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 90, right: 90 }, children: kids,
  });
}
function table(widths, header, rows, o = {}) {
  const hdr = new TableRow({ tableHeader: true, cantSplit: true, children: header.map((t, i) => cell(t, widths[i], { fill: NAVY, color: "FFFFFF", bold: true, keepNext: true, align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })) });
  const body = rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((t, i) => {
    const cfg = typeof t === "object" && !Array.isArray(t) && t !== null && "v" in t ? t : { v: t };
    return cell(cfg.v, widths[i], { align: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, bold: cfg.bold ?? (i === 0 && o.boldFirst), fill: cfg.fill ?? (ri % 2 ? "F7F7FA" : undefined), color: cfg.color, keepNext: ri < rows.length - 1 });
  }) }));
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, rows: [hdr, ...body] });
}
const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });
const img = (file, wPx, hPx) => new ImageRun({ type: file.endsWith(".png") ? "png" : "jpg", data: fs.readFileSync(file), transformation: { width: wPx, height: hPx }, altText: { title: path.basename(file), description: path.basename(file), name: path.basename(file) } });
const figure = (file, wPx, hPx, legenda) => [
  new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 60, after: 40 }, children: [img(file, wPx, hPx)] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(legenda, { size: 16, italics: true, color: GRAYT })] }),
];

// ---------- papel timbrado (imagem de fundo em página inteira, no cabeçalho) ----------
const timbrado = fs.readFileSync(path.join(__dirname, "assets", "timbrado_fundo.png"));
const header = new Header({
  children: SKIP.includes("header") ? [new Paragraph({ children: [] })] : [new Paragraph({ children: [new ImageRun({
    type: "png", data: timbrado, transformation: { width: 793.7, height: 1122.5 },
    altText: { title: "Papel timbrado BR Isolamentos", description: "Fundo do papel timbrado", name: "timbrado" },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
      behindDocument: true, allowOverlap: true, wrap: { type: TextWrappingType.NONE },
    },
  })] })],
});
const footer = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT, spacing: { before: 0 },
    children: [
      run("Estudo simplificado · Cargill · Linhas 1 e 2 · Rev. 00     Página ", { size: 15, color: GRAYT }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: GRAYT }),
      run(" de ", { size: 15, color: GRAYT }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 15, color: GRAYT }),
    ],
  })],
});

// ---------- conteúdo ----------
const L = [];
const tsMax75 = Math.max(...c75.map((x) => x.novo.tsMax));
const dCol = tag === "DN8" ? "Ø 8″" : "Ø 500 mm";

// Título
L.push(para([run("ESTUDO TÉCNICO SIMPLIFICADO", { size: 18, bold: true, color: GREEN, extra: { characterSpacing: 40 } })], { after: 40 }));
L.push(para([run("Eficiência térmica das linhas de ar quente", { size: 40, bold: true, color: NAVY })], { after: 20, line: 240 }));
L.push(para([run("Fornos → Sprays · Linhas 1 e 2", { size: 40, bold: true, color: NAVY })], { after: 100, line: 240 }));
L.push(para([run("Cenários de substituição do isolamento de fibra cerâmica por lã de rocha com chaparia de alumínio novo: efeito na queda de temperatura do ar (ΔT) e no consumo de gás natural", { size: 21, color: GRAYT })], { after: 160 }));

const metaW = [1500, 3000, 1500, 3029];
L.push(new Table({
  width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: metaW,
  rows: [
    new TableRow({ children: [cell("Cliente", metaW[0], { bold: true, fill: LIGHT }), cell("Cargill", metaW[1]), cell("Levantamento", metaW[2], { bold: true, fill: LIGHT }), cell("16/09/2026 (visita técnica)", metaW[3])] }),
    new TableRow({ children: [cell("Escopo", metaW[0], { bold: true, fill: LIGHT }), cell("Linha 1 (Fornos 1 e 2) e Linha 2 (Fornos 3 e 4)", metaW[1]), cell("Emissão", metaW[2], { bold: true, fill: LIGHT }), cell("18/09/2026 · Revisão 00", metaW[3])] }),
    new TableRow({ children: [cell("Elaboração", metaW[0], { bold: true, fill: LIGHT }), cell("BR Isolamentos, Engenharia Térmica", metaW[1]), cell("Natureza", metaW[2], { bold: true, fill: LIGHT }), cell("Estimativa preliminar (resumo)", metaW[3])] }),
  ],
}));
L.push(spacer(80));

// 1. Resumo executivo
L.push(h1("1. Resumo executivo"));
L.push(para(rich([
  `As linhas de ar quente (45 m e 65 m, ${diamTxt}) perdem hoje `,
  { t: "30 °C na Linha 1 e 35 °C na Linha 2", bold: true },
  " entre a saída dos fornos e a entrada dos sprays. Avaliamos a substituição total do isolamento existente (fibra cerâmica, cerca de 20 anos) por isotubo de lã de rocha com chaparia de alumínio nova, em três espessuras.",
])));

const kW = [3009, 3010, 3010];
const kpi = (big, small, fill, col) => cell([
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 }, children: [run(big, { size: 34, bold: true, color: col })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 }, children: [run(small, { size: 16, color: GRAYT })] }),
], 3009, { fill });
L.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: kW, rows: [new TableRow({ cantSplit: true, children: [
  kpi(`${fmt(c100[0].atual.dT, 0)} → ${fmt(c100[0].novo.dT, 1)} °C`, "ΔT da Linha 1 com lã de rocha 100 mm", GLIGHT, GREEN),
  kpi(`${fmt(c100[1].atual.dT, 0)} → ${fmt(c100[1].novo.dT, 1)} °C`, "ΔT da Linha 2 com lã de rocha 100 mm", GLIGHT, GREEN),
  kpi(`${sgn(pct(t100.perda), 0)}%`, "perda térmica total (lã de rocha 100 mm)", GLIGHT, GREEN),
] })] }));
L.push(spacer(100));

L.push(bullet(rich([
  { t: "Lã de rocha 50 mm: ", bold: true },
  `não reduz o ΔT (${fmt(c50[0].novo.dT)} °C na Linha 1 e ${fmt(c50[1].novo.dT)} °C na Linha 2), porque o isolamento atual, de 100 mm, é mais espesso. A espessura de equilíbrio, a partir da qual há ganho, é de ≈ ${fmt0(eqMm)} mm.`,
])));
L.push(bullet(rich([
  { t: "Lã de rocha 100 mm (2 camadas de 50 mm, juntas defasadas), recomendada: ", bold: true },
  `ΔT de ${fmt(c100[0].novo.dT)} °C (Linha 1) e ${fmt(c100[1].novo.dT)} °C (Linha 2), perda ${fmt(perdaAtual)} → ${fmt(t100.perda)} kW, economia de ${fmt0(t100.m3)} m³/ano de gás natural (R$ ${fmt0(t100.m3 * M.GAS.precoRefM3)}/ano a R$ ${fmt(M.GAS.precoRefM3, 2)}/m³) e ${fmt(t100.co2, 1)} tCO₂/ano evitadas.`,
])));
L.push(bullet(rich([
  { t: "Segurança: ", bold: true },
  `superfície de ≈ ${fmt0(tsMax50)} °C com 50 mm e ${fmt0(tsMax100)} °C com 100 mm (área fechada, sem vento), frente ao critério usual de 60 °C para proteção pessoal [6].`,
]), { after: 100 }));

// 2. Situação encontrada
L.push(h1("2. Situação encontrada em campo"));
const sW = [2100, 1000, 1200, 1300, 1300, 1129, 1000];
L.push(table(sW, ["Linha", "Extensão", "Diâmetro", "Saída dos fornos", "Entrada dos sprays", "ΔT medido", "Área fechada"], [
  ["Linha 1 (Fornos 1 e 2)", "45 m", dCol, "380 °C", "350 °C", { v: "30 °C", bold: true }, "≈ 10 m"],
  ["Linha 2 (Fornos 3 e 4)", "65 m", dCol, "325 °C", "290 °C", { v: "35 °C", bold: true }, "≈ 10 m"],
]));
L.push(spacer(80));
L.push(bullet("Cerca de 95% da extensão tem fibra cerâmica com chaparia metálica, em operação há cerca de 20 anos; as saídas dos fornos estão sem isolamento ou danificadas. A termografia (16/09/2026) mostra chaparia não uniforme: a maior parte entre 25 e 67 °C, com pontos quentes de 76 a 186 °C em juntas, flanges, passagens de parede e saídas dos fornos."));
L.push(bullet("As leituras usaram emissividade 0,97; em alumínio os valores absolutos ficam subestimados. Servem como evidência qualitativa e serão recalibradas no estudo detalhado.", { after: 100 }));

const irFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".jpg"));
const irPath = (id) => path.join(ROOT, irFiles.find((f) => f.includes(id)));
const irW = 4380, gap = 269;
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NOB = { top: NB, bottom: NB, left: NB, right: NB };
const irCell = (id, cap) => new TableCell({
  width: { size: irW, type: WidthType.DXA }, borders: NOB, margins: { top: 40, bottom: 40, left: 40, right: 40 },
  children: [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 30 }, children: [img(irPath(id), 290, 218)] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(cap, { size: 15, italics: true, color: GRAYT })] }),
  ],
});
if (!SKIP.includes("ir")) L.push(new Table({ width: { size: irW * 2 + gap, type: WidthType.DXA }, columnWidths: [irW, gap, irW], alignment: AlignmentType.CENTER, rows: [
  new TableRow({ cantSplit: true, children: [irCell("IR_01092", "Figura 1: faixas quentes nas juntas do duto (máx. 185,9 °C)"), new TableCell({ width: { size: gap, type: WidthType.DXA }, borders: NOB, children: [new Paragraph({ children: [] })] }), irCell("IR_01109", "Figura 2: anel quente na passagem de parede (máx. 123,1 °C)")] }),
] }));

// 3. Metodologia
L.push(h1("3. Metodologia de cálculo"));
L.push(bullet(rich([{ t: "Perda de calor por metro de tubo. ", bold: true }, "Condução no isolante (condutividade variável com a temperatura) em equilíbrio com convecção e radiação na superfície externa, resolvida por iteração, conforme ASTM C680 [1] e ISO 12241 [2], com as correlações de convecção de [3][4]. Referência de prática de projeto industrial: [5]."])));
L.push(bullet(rich([{ t: "Queda de temperatura ao longo da linha. ", bold: true }, "Balanço de energia trecho a trecho (m·cp·dT = −q′·dx), separando área fechada e ar livre. O isolamento atual é calibrado para reproduzir o ΔT medido, e a mesma vazão é usada para calcular cada cenário novo."])));
L.push(bullet(rich([{ t: "Energia, custo e carbono. ", bold: true }, "A diferença de perda, multiplicada pelas horas de operação, é convertida em gás natural (poder calorífico e eficiência do gerador) e em CO₂."]), { after: 100 }));

// 4. Premissas
L.push(h1("4. Premissas e sua base"));
const pW = [1750, 4779, 2500];
const premissas = [
  ["Medições", "Linha 1: 45 m, 380 → 350 °C. Linha 2: 65 m, 325 → 290 °C. Cerca de 10 m de cada linha em área fechada.", "Medido em 16/09/2026"],
  ["Diâmetro do tubo", tag === "DN8" ? "Ø 8″ (219,1 mm), tubo sem isolamento." : "Ø 500 mm, tubo sem isolamento, conforme os desenhos de projeto.", tag === "DN8" ? "Informado pela Cargill. A confirmar." : "Desenhos de projeto. A confirmar."],
  ["Isolamento atual", "Fibra cerâmica 96 kg/m³, 100 mm, chaparia envelhecida (emissividade 0,25).", "Adotado. Sondagem a confirmar."],
  ["Degradação do atual", "Condutividade majorada em 30% pelos 20 anos de operação. Ensaios de envelhecimento térmico indicam +3% a +9% em lã mineral e ≈ +24% em fibra de alta temperatura [7][8]; frestas e trechos danificados vistos na termografia somam-se em campo [9].", "Literatura [7][8][9]. Fator por hipótese, a calibrar com a vazão."],
  ["Isolamento novo", "Isotubo de lã de rocha 64 kg/m³ com alumínio novo (emissividade 0,07). Condutividade majorada em 5% para singularidades de montagem.", "Propriedades técnicas adotadas. Margem por hipótese."],
  ["Vazão de ar", `Deduzida do ΔT medido: ≈ ${fmt0(nm3h[0])} e ${fmt0(nm3h[1])} Nm³/h (≈ ${fmt0(vel[0])} e ${fmt0(vel[1])} m/s). Vazão real maior implica isolamento atual pior e ganho maior.`, "Calculada. A medir."],
  ["Ambiente, operação e gás", `Ao ar livre 25 °C e vento de 2 m/s; área fechada 30 °C, sem vento. 24 h/dia, 330 dias/ano (7.920 h/ano). Gás natural: R$ ${fmt(M.GAS.precoRefM3, 2)}/m³, 9,65 kWh/m³, eficiência do gerador 75%, 2,0 kg CO₂/m³.`, "Hipóteses e referências. Consumo e preço a confirmar."],
];
L.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: pW, rows: [
  new TableRow({ tableHeader: true, cantSplit: true, children: ["Premissa", "Valor adotado", "Base"].map((t, i) => cell(t, pW[i], { fill: NAVY, color: "FFFFFF", bold: true })) }),
  ...premissas.map((r) => new TableRow({ cantSplit: true, children: [cell(r[0], pW[0], { bold: true, fill: LIGHT }), cell(r[1], pW[1]), cell(r[2], pW[2], { color: GRAYT })] })),
] }));

// 5. Resultados
L.push(h1("5. Resultados: ΔT e perda térmica"));
const rW = [3029, 1500, 1500, 1500, 1500];
const cmpCell = (v, good) => ({ v, bold: true, color: good ? GREEN : RED });
L.push(table(rW, ["Indicador", "Situação atual", "Cenário 50 mm", "Cenário 75 mm", "Cenário 100 mm"], [
  ["ΔT Linha 1 (°C)", fmt(c50[0].atual.dT), cmpCell(fmt(c50[0].novo.dT), false), fmt(c75[0].novo.dT), cmpCell(fmt(c100[0].novo.dT), true)],
  ["Chegada aos sprays, Linha 1 (°C)", fmt(c50[0].atual.tSaida), fmt(c50[0].novo.tSaida), fmt(c75[0].novo.tSaida), fmt(c100[0].novo.tSaida)],
  ["ΔT Linha 2 (°C)", fmt(c50[1].atual.dT), cmpCell(fmt(c50[1].novo.dT), false), fmt(c75[1].novo.dT), cmpCell(fmt(c100[1].novo.dT), true)],
  ["Chegada aos sprays, Linha 2 (°C)", fmt(c50[1].atual.tSaida), fmt(c50[1].novo.tSaida), fmt(c75[1].novo.tSaida), fmt(c100[1].novo.tSaida)],
  [{ v: "Perda térmica total (kW)", bold: true }, { v: fmt(perdaAtual), bold: true }, { v: fmt(t50.perda), bold: true }, { v: fmt(t75.perda), bold: true }, { v: fmt(t100.perda), bold: true }],
  ["Variação da perda vs. atual", "-", cmpCell(sgn(pct(t50.perda)) + "%", false), sgn(pct(t75.perda)) + "%", cmpCell(sgn(pct(t100.perda)) + "%", true)],
  ["Superfície máx. (área fechada, °C)", "-", fmt0(tsMax50), fmt0(tsMax75), fmt0(tsMax100)],
]));
L.push(spacer(100));
if (!SKIP.includes("figs")) L.push(...figure(path.join(__dirname, "graficos", `espessura_${tag}.png`), 520, 234, "Figura 3: ΔT final em função da espessura da lã de rocha, comparado ao ΔT medido hoje."));
if (!SKIP.includes("figs")) L.push(...figure(path.join(__dirname, "graficos", `perfil_${tag}.png`), 540, 284, "Figura 4: temperatura do ar ao longo de cada linha, na situação atual e nos cenários de 50 e 100 mm."));

L.push(h2("Sensibilidade ao estado do isolamento atual"));
L.push(para("O ΔT medido hoje (30 e 35 °C) é fixo. Quanto pior o isolamento atual, mais calor ele perde e, para render o mesmo ΔT medido, maior precisa ser a vazão de ar. O isolamento novo perde o mesmo calor em qualquer caso, que repartido por mais ar produz um ΔT menor. Ou seja, quanto mais degradado o atual, maior o ganho da troca. Valores para Linha 1 / Linha 2:", { keepNext: true, keepLines: true }));
const sW2 = [2929, 2100, 2000, 2000];
const sensRow = (f, nome) => [nome,
  `${fmt0(R.sens[f]["50"][0].nm3h)} / ${fmt0(R.sens[f]["50"][1].nm3h)}`,
  `${fmt(R.sens[f]["50"][0].dTnovo)} / ${fmt(R.sens[f]["50"][1].dTnovo)} °C`,
  `${fmt(R.sens[f]["100"][0].dTnovo)} / ${fmt(R.sens[f]["100"][1].dTnovo)} °C`];
L.push(table(sW2, ["Estado atual do isolamento", "Vazão implícita (Nm³/h)", "ΔT após a troca, 50 mm", "ΔT após a troca, 100 mm"], [
  sensRow("1", "Sem degradação (fator 1,0)"),
  (() => { const r = sensRow("1.3", "Adotado no estudo (fator 1,3)"); return r.map((t) => ({ v: t, bold: true, fill: GLIGHT })); })(),
  sensRow("1.6", "Degradado (fator 1,6)"),
  sensRow("2", "Muito degradado (fator 2,0)"),
]));
L.push(para([run("Vazão implícita: a que reproduz o ΔT medido hoje (30 e 35 °C) com o estado indicado. Ensaios de laboratório [7][8] ficam entre 1,03 e 1,24; em campo tende a ser pior [9].", { size: 16, italics: true, color: GRAYT })], { before: 60 }));

// 6. Financeiro
L.push(h1("6. Análise financeira e ambiental"));
L.push(para(`Economia anual em relação à situação atual, com gás natural a R$ ${fmt(M.GAS.precoRefM3, 2)}/m³ e 7.920 h/ano de operação:`, { keepNext: true }));
const fW = [3029, 2000, 2000, 2000];
const negc = (v) => ({ v, bold: true, color: RED });
L.push(table(fW, ["Indicador", "Cenário 50 mm", "Cenário 75 mm", "Cenário 100 mm"], [
  ["Gás natural, Linha 1 (m³/ano)", negc(sgn(c50[0].fin.m3Ano, 0)), sgn(c75[0].fin.m3Ano, 0), { v: sgn(c100[0].fin.m3Ano, 0), bold: true, color: GREEN }],
  ["Gás natural, Linha 2 (m³/ano)", negc(sgn(c50[1].fin.m3Ano, 0)), sgn(c75[1].fin.m3Ano, 0), { v: sgn(c100[1].fin.m3Ano, 0), bold: true, color: GREEN }],
  ["Gás natural, total (m³/ano)", negc(sgn(t50.m3, 0)), sgn(t75.m3, 0), { v: sgn(t100.m3, 0), bold: true, color: GREEN }],
  ["Economia total (R$/ano)", negc(sgn(t50.m3 * M.GAS.precoRefM3, 0)), sgn(t75.m3 * M.GAS.precoRefM3, 0), { v: sgn(t100.m3 * M.GAS.precoRefM3, 0), bold: true, color: GREEN }],
  ["CO₂ evitado (tCO₂/ano)", negc(sgn(t50.co2)), sgn(t75.co2), { v: sgn(t100.co2), bold: true, color: GREEN }],
]));
L.push(spacer(80));
const gW = [3029, 2000, 2000, 2000];
L.push(table(gW, ["Cenário 100 mm: preço do gás (R$/m³)", "R$ 3,50", "R$ 5,00", "R$ 7,50 (referência)"], [
  ["Economia anual (R$/ano)", fmt0(t100.m3 * 3.5), fmt0(t100.m3 * 5), { v: fmt0(t100.m3 * 7.5), bold: true }],
]));
L.push(para([run("Valores negativos indicam aumento de perda e de consumo em relação ao isolamento atual. O retorno do investimento será calculado com o orçamento de execução.", { size: 16, italics: true, color: GRAYT })], { before: 60 }));

// 7. Conclusões
L.push(h1("7. Conclusões e recomendações"));
L.push(bullet(rich([{ t: "50 mm não é suficiente. ", bold: true }, `Com o isolamento atual de fibra cerâmica de 100 mm, essa espessura perde mais calor que a instalação existente (ΔT de ${fmt(c50[0].atual.dT, 0)} para ${fmt(c50[0].novo.dT)} °C na Linha 1). O ganho só aparece acima de ≈ ${fmt0(eqMm)} mm.`])));
L.push(bullet(rich([{ t: "Recomendamos lã de rocha de 100 mm ou mais, em 2 camadas com juntas defasadas, ", bold: true }, `com chaparia de alumínio nova: o ΔT cai cerca de ${fmt(c100[0].atual.dT - c100[0].novo.dT, 0)} °C na Linha 1 e ${fmt(c100[1].atual.dT - c100[1].novo.dT, 0)} °C na Linha 2, a superfície fica próxima de 60 °C e a economia é de ${fmt0(t100.m3)} m³/ano de gás.`])));
L.push(bullet(rich([{ t: "Tratar os pontos singulares. ", bold: true }, "Flanges, juntas de expansão, suportes, passagens de parede e saídas dos fornos concentram os pontos quentes e devem receber isolamento e capas removíveis específicos."]), { after: 100 }));

// 8. Dados a confirmar
L.push(h1("8. Dados a confirmar para o estudo detalhado"));
L.push(para("Este documento é um resumo preliminar, de ordem de grandeza. Para fechar o resultado, precisamos de:", { keepNext: true }));
const dW = [3200, 5829];
L.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: dW, rows: [
  new TableRow({ tableHeader: true, cantSplit: true, children: ["Dado a coletar", "Por que importa"].map((t, i) => cell(t, dW[i], { fill: NAVY, color: "FFFFFF", bold: true, keepNext: true })) }),
  ...[
    ["1. Diâmetro do tubo (8″ ou 500 mm)", "Define a área de troca de calor; energia e economia são proporcionais a ela."],
    ["2. Vazão de ar da Linha 1", "Com a vazão medida, o estado real do isolamento atual deixa de ser hipótese e passa a ser calculado."],
    ["3. Vazão de ar da Linha 2", "Idem, para a Linha 2, que opera em outra temperatura e extensão."],
    ["4. Consumo e preço do gás do forno de aquecimento do ar", "Convertem a energia poupada em m³, R$ e CO₂ reais da planta e checam a eficiência do gerador."],
  ].map((r, ri, arr) => new TableRow({ cantSplit: true, children: [cell(r[0], dW[0], { bold: true, fill: LIGHT, keepNext: ri < arr.length - 1 }), cell(r[1], dW[1], { keepNext: ri < arr.length - 1 })] })),
] }));
L.push(spacer(60));
L.push(para("O estudo detalhado inclui ainda termografia calibrada, sondagem do isolamento existente, cadastro completo do traçado, espessura econômica e retorno do investimento com o orçamento de execução."));

// 9. Referências
L.push(h1("9. Referências"));
const refs = [
  "[1] ASTM C680. Estimate of the Heat Gain or Loss and the Surface Temperatures of Insulated Flat, Cylindrical, and Spherical Systems by Use of Computer Programs.",
  "[2] ISO 12241. Thermal insulation for building equipment and industrial installations: Calculation rules.",
  "[3] Churchill, S. W.; Chu, H. H. S. Correlating equations for laminar and turbulent free convection from a horizontal cylinder. Int. J. Heat Mass Transfer, v. 18, n. 9, 1975.",
  "[4] Incropera, F. P. et al. Fundamentals of Heat and Mass Transfer (convecção externa, propriedades do ar e emissividades).",
  "[5] Petrobras N-550. Projeto de isolamento térmico a alta temperatura.",
  "[6] ASTM C1055. Heated System Surface Conditions that Produce Contact Burn Injuries.",
  "[7] Thermal Aging Effect on Thermal Conductivity Properties of Mineral Wool Pipe Samples at High Temperature.",
  "[8] Thermal performance and ageing effects to model the life cycle assessment of heat-protective thermal insulation materials in pipe systems. ScienceDirect, 2025.",
  "[9] U.S. DOE, Advanced Manufacturing Office. Steam Tip Sheet #2: Insulate Steam Distribution and Condensate Return Lines.",
];
for (const t of refs) L.push(para([run(t, { size: 15, color: GRAYT })], { after: 30, line: 240 }));
L.push(spacer(40));
L.push(para([run("Estudo elaborado com base no levantamento de 16/09/2026 e nas premissas da seção 4. Valores sujeitos a validação em campo.", { size: 16, italics: true, color: GRAYT })]));

// ---------- documento ----------
const doc = new Document({
  creator: "BR Isolamentos", title: "Estudo simplificado de eficiência térmica – Cargill", description: "Linhas 1 e 2 – Fornos → Sprays",
  styles: {
    default: { document: { run: { font: FONT, size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: FONT, color: NAVY }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, font: FONT, color: NAVY }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } }, run: { color: GREEN, bold: true } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11909, height: 16834 }, margin: { top: 1300, right: 1440, bottom: 1700, left: 1440, header: 720, footer: 720 } } },
    headers: { default: header }, footers: { default: footer }, children: L,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("Gerado:", OUT, (buf.length / 1024).toFixed(0), "KB"); });
