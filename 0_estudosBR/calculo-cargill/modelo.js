// Modelo do estudo simplificado — Cargill, Linhas 1 e 2 (Fornos -> Sprays).
//
// Usa o MOTOR DE CÁLCULO DO SITE (engine/calculadora-termica.js, compilado de
// lib/calculadora-termica.ts) para o fluxo de calor por metro de tubo em cada
// temperatura do ar, e acompanha a queda de temperatura do ar ao longo da linha
// (balanço de energia: m·cp·dT = -q'(T)·dx).
//
// Lógica de calibração (a vazão de ar NÃO é conhecida):
//   1. Estado atual = fibra cerâmica (espessura e fator de degradação como
//      hipótese) -> perda por metro q'(T).
//   2. A vazão (m·cp) é ajustada para reproduzir a queda medida em campo
//      (380->350 °C e 325->290 °C).
//   3. Com a MESMA vazão, calcula-se a queda com o isolamento novo.
// Assim o resultado depende só da razão entre as perdas nova/atual, não da vazão.

const E = require("./engine/calculadora-termica.js");

const K = {
  fibraCeramica96: "0.00000011 * T**2 + 0.00011 * T + 0.035", // materials_internal.py
  laRocha64: "0.00000017 * T**2 + 0.00007 * T + 0.032", // materials_internal.py
};
const EPS = { aluminioNovoFosco: 0.07, aluminioOxidado: 0.25 }; // acabamentos do sistema
const CP_AR = 1050; // J/kg.K, ar a 300-380 °C

const LINHAS = [
  { id: 1, nome: "Linha 1 (Fornos 1 e 2)", comprimentoM: 45, tEntrada: 380, tSaidaMedida: 350 },
  { id: 2, nome: "Linha 2 (Fornos 3 e 4)", comprimentoM: 65, tEntrada: 325, tSaidaMedida: 290 },
];

// 10 m de cada linha em área fechada (levantamento); resto ao ar livre.
const ZONA_FECHADA = { comprimentoM: 10, tAmb: 30, vento: 0 };
const ZONA_ABERTA = { tAmb: 25, vento: 2 };

/** Perda de calor por metro [W/m] e temperatura de face fria [°C] a uma dada temperatura do ar. */
function perdaPorMetro(tAr, zona, camada, diametroM) {
  const kf = `${camada.fatorK}*(${camada.k})`;
  const r = E.encontrarTemperaturaFaceFria(
    tAr, zona.tAmb, camada.espessuraMm / 1000, kf, "tubulacao", camada.eps, diametroM, zona.vento
  );
  if (!r.convergiu) throw new Error(`Motor não convergiu: T=${tAr} ${JSON.stringify(camada)}`);
  const dExt = diametroM + 2 * camada.espessuraMm / 1000;
  return { q: r.qTransferencia * Math.PI * dExt, ts: r.temperaturaFaceFria };
}

/** Marcha ao longo da linha. Retorna T de saída, perda total [W] e perfil. */
function marchar(linha, camada, mcp, diametroM, dx = 0.5) {
  let t = linha.tEntrada;
  let perdaW = 0;
  const perfil = [{ x: 0, t }];
  const n = Math.round(linha.comprimentoM / dx);
  let tsMax = 0;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * dx;
    const zona = x < ZONA_FECHADA.comprimentoM ? ZONA_FECHADA : ZONA_ABERTA;
    const { q, ts } = perdaPorMetro(t, zona, camada, diametroM);
    const dq = q * dx;
    perdaW += dq;
    t -= dq / mcp;
    tsMax = Math.max(tsMax, ts);
    perfil.push({ x: (i + 1) * dx, t });
  }
  return { tSaida: t, perdaW, perfil, tsMax };
}

/** m·cp [W/K] que reproduz a queda medida com a camada 'atual'. */
function calibrarMcp(linha, camadaAtual, diametroM) {
  let lo = 20, hi = 20000; // W/K
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { tSaida } = marchar(linha, camadaAtual, mid, diametroM);
    // mais vazão -> menor queda -> tSaida maior
    if (tSaida < linha.tSaidaMedida) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function camada({ isolante, espessuraMm, eps, fatorK }) {
  return { k: K[isolante], espessuraMm, eps, fatorK };
}

const ATUAL_BASE = { isolante: "fibraCeramica96", espessuraMm: 100, eps: EPS.aluminioOxidado, fatorK: 1.3 };
const NOVO_BASE = { isolante: "laRocha64", eps: EPS.aluminioNovoFosco, fatorK: 1.05 };

/** Avalia uma linha: atual calibrado x novo (espessura dada). */
function avaliarLinha(linha, diametroM, { atual = ATUAL_BASE, espessuraNovaMm = 50 } = {}) {
  const cAtual = camada(atual);
  const mcp = calibrarMcp(linha, cAtual, diametroM);
  const a = marchar(linha, cAtual, mcp, diametroM);
  const cNovo = camada({ ...NOVO_BASE, espessuraMm: espessuraNovaMm });
  const n = marchar(linha, cNovo, mcp, diametroM);
  // vazão implícita e velocidade (referência de plausibilidade)
  const mKgS = mcp / CP_AR;
  const tMed = (linha.tEntrada + linha.tSaidaMedida) / 2 + 273.15;
  const rho = 101325 / (287 * tMed);
  const dInt = diametroM - 0.012;
  const vel = mKgS / rho / (Math.PI * dInt ** 2 / 4);
  return {
    linha, mcp, mKgS, nm3h: (mKgS / 1.293) * 3600, vel,
    atual: { dT: linha.tEntrada - a.tSaida, tSaida: a.tSaida, perdaKW: a.perdaW / 1000, wm: a.perdaW / linha.comprimentoM, tsMax: a.tsMax },
    novo: { dT: linha.tEntrada - n.tSaida, tSaida: n.tSaida, perdaKW: n.perdaW / 1000, wm: n.perdaW / linha.comprimentoM, tsMax: n.tsMax, espessuraMm: espessuraNovaMm },
    perfilAtual: a.perfil, perfilNovo: n.perfil,
  };
}

// --- Financeiro / ambiental (mesma tabela COMBUSTIVEIS do site: gás natural) ---
const GAS = { precoRefM3: 7.5, pcKwhM3: 9.65, ef: 0.75, fatorCO2KgM3: 2.0 };
const HORAS_ANO = 7920; // 24 h x 330 dias (operação contínua com paradas programadas) — hipótese

function financeiro(deltaQKw, precoM3 = GAS.precoRefM3, horas = HORAS_ANO) {
  const kwhAno = deltaQKw * horas;
  const m3Ano = kwhAno / (GAS.pcKwhM3 * GAS.ef);
  return { kwhAno, m3Ano, reaisAno: m3Ano * precoM3, co2TonAno: (m3Ano * GAS.fatorCO2KgM3) / 1000 };
}

module.exports = {
  E, K, EPS, LINHAS, ATUAL_BASE, NOVO_BASE, GAS, HORAS_ANO, ZONA_FECHADA, ZONA_ABERTA,
  perdaPorMetro, marchar, calibrarMcp, avaliarLinha, financeiro, camada,
};
