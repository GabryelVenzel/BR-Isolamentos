// Gera os gráficos do relatório (SVG -> PNG via Chrome/Edge headless).
// uso: node graficos.js DN8|D500
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const tag = process.argv[2] || "DN8";
const R = require(`./resultados_${tag}.json`);
const outDir = path.join(__dirname, "graficos");
fs.mkdirSync(outDir, { recursive: true });

const NAVY = "#060035", GREEN = "#078B41", AMBER = "#D9A400", GRAY = "#6B7280", GRID = "#E5E7EB", RED = "#C62828";
const FONT = "font-family:Arial,Helvetica,sans-serif";

const nice = (v, d = 0) => v.toFixed(d).replace(".", ",");

function axis(x0, y0, w, h, xMin, xMax, yMin, yMax, xTicks, yTicks, xLabel, yLabel) {
  const sx = (v) => x0 + ((v - xMin) / (xMax - xMin)) * w;
  const sy = (v) => y0 + h - ((v - yMin) / (yMax - yMin)) * h;
  let s = "";
  for (const t of yTicks) {
    s += `<line x1="${x0}" x2="${x0 + w}" y1="${sy(t)}" y2="${sy(t)}" stroke="${GRID}" stroke-width="2"/>`;
    s += `<text x="${x0 - 14}" y="${sy(t) + 8}" text-anchor="end" font-size="26" fill="${NAVY}" style="${FONT}">${t}</text>`;
  }
  for (const t of xTicks) {
    s += `<line x1="${sx(t)}" x2="${sx(t)}" y1="${y0 + h}" y2="${y0 + h + 8}" stroke="${NAVY}" stroke-width="2"/>`;
    s += `<text x="${sx(t)}" y="${y0 + h + 38}" text-anchor="middle" font-size="26" fill="${NAVY}" style="${FONT}">${t}</text>`;
  }
  s += `<line x1="${x0}" x2="${x0 + w}" y1="${y0 + h}" y2="${y0 + h}" stroke="${NAVY}" stroke-width="3"/>`;
  s += `<line x1="${x0}" x2="${x0}" y1="${y0}" y2="${y0 + h}" stroke="${NAVY}" stroke-width="3"/>`;
  s += `<text x="${x0 + w / 2}" y="${y0 + h + 78}" text-anchor="middle" font-size="26" fill="${NAVY}" style="${FONT}">${xLabel}</text>`;
  s += `<text transform="translate(${x0 - 78},${y0 + h / 2}) rotate(-90)" text-anchor="middle" font-size="26" fill="${NAVY}" style="${FONT}">${yLabel}</text>`;
  return { s, sx, sy };
}

const poly = (pts, sx, sy, color, width = 5, dash = "") =>
  `<polyline fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ""} points="${pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.t).toFixed(1)}`).join(" ")}"/>`;

// ---------- Gráfico 1: perfil de temperatura do ar ao longo de cada linha ----------
function grafPerfil() {
  const W = 1600, H = 840;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  const paineis = [
    { i: 0, x0: 130, yMin: 340, yMax: 385, yTicks: [340, 350, 360, 370, 380], xMax: 45, xTicks: [0, 10, 20, 30, 40] },
    { i: 1, x0: 900, yMin: 280, yMax: 330, yTicks: [280, 290, 300, 310, 320, 330], xMax: 65, xTicks: [0, 10, 20, 30, 40, 50, 60] },
  ];
  for (const p of paineis) {
    const c50 = R.cenarios["50"][p.i], c100 = R.cenarios["100"][p.i];
    const w = 520, h = 520, y0 = 110;
    const a = axis(p.x0, y0, w, h, 0, p.xMax, p.yMin, p.yMax, p.xTicks, p.yTicks, "Distância percorrida (m)", "Temperatura do ar (°C)");
    svg += a.s;
    svg += `<text x="${p.x0}" y="60" font-size="32" font-weight="bold" fill="${NAVY}" style="${FONT}">${c50.linha.nome}</text>`;
    svg += poly(c50.perfilAtual, a.sx, a.sy, GRAY, 6);
    svg += poly(c50.perfilNovo, a.sx, a.sy, AMBER, 6);
    svg += poly(c100.perfilNovo, a.sx, a.sy, GREEN, 6);
    const L = c50.linha.comprimentoM;
    const fim = [
      { t: c50.atual.tSaida, col: GRAY },
      { t: c50.novo.tSaida, col: AMBER },
      { t: c100.novo.tSaida, col: GREEN },
    ];
    // rótulos à direita do ponto final, com espaçamento mínimo (ordena por valor, de cima p/ baixo)
    const ord = [...fim].sort((u, v) => v.t - u.t);
    let lastY = -1e9;
    for (const f of ord) {
      let y = a.sy(f.t) + 9;
      if (y - lastY < 34) y = lastY + 34;
      lastY = y;
      svg += `<circle cx="${a.sx(L)}" cy="${a.sy(f.t)}" r="8" fill="${f.col}"/>`;
      svg += `<text x="${a.sx(L) + 18}" y="${y}" font-size="26" font-weight="bold" fill="${f.col === AMBER ? "#8A6A00" : f.col}" style="${FONT}">${nice(f.t, 1)} °C</text>`;
    }
    svg += `<circle cx="${a.sx(0)}" cy="${a.sy(c50.linha.tEntrada)}" r="8" fill="${NAVY}"/>`;
    svg += `<text x="${a.sx(0) + 16}" y="${a.sy(c50.linha.tEntrada) - 14}" font-size="26" font-weight="bold" fill="${NAVY}" style="${FONT}">${c50.linha.tEntrada} °C</text>`;
  }
  // legenda
  const ly = 800;
  const leg = [
    [GRAY, "Atual (medido em campo)"],
    [AMBER, "Cenário 50 mm"],
    [GREEN, "Cenário 100 mm"],
  ];
  let lx = 130;
  for (const [col, txt] of leg) {
    svg += `<line x1="${lx}" x2="${lx + 56}" y1="${ly - 8}" y2="${ly - 8}" stroke="${col}" stroke-width="7" stroke-linecap="round"/>`;
    svg += `<text x="${lx + 70}" y="${ly}" font-size="26" fill="${NAVY}" style="${FONT}">${txt}</text>`;
    lx += 70 + txt.length * 15 + 80;
  }
  return svg + "</svg>";
}

// ---------- Gráfico 2: ΔT final x espessura da lã de rocha ----------
function grafEspessura() {
  const W = 1600, H = 720;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  const x0 = 150, y0 = 40, w = 1000, h = 520;
  const a = axis(x0, y0, w, h, 30, 150, 10, 45, [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150], [10, 15, 20, 25, 30, 35, 40, 45],
    "Espessura da lã de rocha (mm)", "Queda de temperatura no trecho, ΔT (°C)");
  svg += a.s;
  const series = [
    { i: 0, col: NAVY, nome: "Linha 1" },
    { i: 1, col: GREEN, nome: "Linha 2" },
  ];
  for (const s of series) {
    const atual = R.grade[0].linhas[s.i].dTatual;
    svg += `<line x1="${a.sx(30)}" x2="${a.sx(150)}" y1="${a.sy(atual)}" y2="${a.sy(atual)}" stroke="${s.col}" stroke-width="4" stroke-dasharray="14 10"/>`;
    svg += `<text x="${a.sx(150) + 14}" y="${a.sy(atual) + 9}" font-size="26" fill="${s.col}" style="${FONT}">Atual: ${nice(atual, 0)} °C</text>`;
    svg += poly(R.grade.map((g) => ({ x: g.esp, t: g.linhas[s.i].dTnovo })), a.sx, a.sy, s.col, 6);
    for (const g of R.grade) {
      if (g.esp === 50 || g.esp === 100) {
        const v = g.linhas[s.i].dTnovo;
        svg += `<circle cx="${a.sx(g.esp)}" cy="${a.sy(v)}" r="10" fill="${s.col}" stroke="#fff" stroke-width="3"/>`;
        const esq = g.esp === 50;
        const dy = esq ? 9 : s.i === 1 ? -22 : 40; // L2 (verde) acima, L1 (azul) abaixo no ponto de 100 mm
        svg += `<text x="${a.sx(g.esp) + (esq ? -18 : 0)}" y="${a.sy(v) + dy}" text-anchor="${esq ? "end" : "middle"}" font-size="26" font-weight="bold" fill="${s.col}" style="${FONT}">${nice(v, 1)} °C</text>`;
      }
    }
  }
  // espessura de equilíbrio da linha 1 (onde ΔT novo = ΔT atual)
  const g = R.grade;
  const cruz = (i) => {
    for (let k = 0; k < g.length - 1; k++) {
      const d0 = g[k].linhas[i].dTnovo - g[k].linhas[i].dTatual, d1 = g[k + 1].linhas[i].dTnovo - g[k + 1].linhas[i].dTatual;
      if (d0 >= 0 && d1 <= 0) return g[k].esp + (10 * d0) / (d0 - d1);
    }
    return null;
  };
  const eq = cruz(0);
  if (eq) {
    svg += `<line x1="${a.sx(eq)}" x2="${a.sx(eq)}" y1="${y0}" y2="${y0 + h}" stroke="${RED}" stroke-width="3" stroke-dasharray="4 8"/>`;
    svg += `<text x="${a.sx(eq) + 12}" y="${y0 + 34}" font-size="26" font-weight="bold" fill="${RED}" style="${FONT}">Equilíbrio ≈ ${Math.round(eq)} mm</text>`;
    svg += `<text x="${a.sx(eq) + 12}" y="${y0 + 66}" font-size="24" fill="${RED}" style="${FONT}">(abaixo disso, ΔT piora)</text>`;
  }
  // legenda
  let lx = 150; const ly = 690;
  for (const s of series) {
    svg += `<line x1="${lx}" x2="${lx + 56}" y1="${ly - 8}" y2="${ly - 8}" stroke="${s.col}" stroke-width="7" stroke-linecap="round"/>`;
    svg += `<text x="${lx + 70}" y="${ly}" font-size="26" fill="${NAVY}" style="${FONT}">${s.nome} com isolamento novo</text>`;
    lx += 480;
  }
  svg += `<line x1="${lx}" x2="${lx + 56}" y1="${ly - 8}" y2="${ly - 8}" stroke="${NAVY}" stroke-width="4" stroke-dasharray="14 10"/>`;
  svg += `<text x="${lx + 70}" y="${ly}" font-size="26" fill="${NAVY}" style="${FONT}">ΔT medido hoje</text>`;
  return { svg: svg + "</svg>", eq };
}

function render(name, svg, w, h) {
  const html = path.join(outDir, `${name}.html`);
  const png = path.join(outDir, `${name}.png`);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`);
  const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${w},${h}`,
    `--screenshot=${png}`, "file:///" + html.replace(/\\/g, "/"),
  ], { stdio: "ignore", timeout: 60000 });
  return png;
}

const p1 = render(`perfil_${tag}`, grafPerfil(), 1600, 840);
const g2 = grafEspessura();
const p2 = render(`espessura_${tag}`, g2.svg, 1600, 720);
console.log(p1, p2, "espessura de equilíbrio L1:", g2.eq && g2.eq.toFixed(1));
