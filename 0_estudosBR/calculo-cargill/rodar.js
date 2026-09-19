// Executa o estudo para um diâmetro e imprime/gera resultados.json
// uso: node rodar.js 0.2191   |   node rodar.js 0.5
const fs = require("fs");
const M = require("./modelo.js");

const D = parseFloat(process.argv[2] || "0.2191");
const tag = D < 0.3 ? "DN8" : "D500";

const out = { D, tag, cenarios: {}, sens: {}, espessuras: {} };

// 1) Cenários: proposta cliente (50 mm) e alternativa (100 mm)
for (const esp of [50, 75, 100, 125, 150]) {
  out.cenarios[esp] = M.LINHAS.map((l) => {
    const r = M.avaliarLinha(l, D, { espessuraNovaMm: esp });
    const dq = r.atual.perdaKW - r.novo.perdaKW;
    return { ...r, deltaQKw: dq, fin: M.financeiro(dq) };
  });
}

// 2) Sensibilidade ao estado atual (fator de degradação f) — proposta 50 e 100 mm
for (const f of [1.0, 1.3, 1.6, 2.0]) {
  out.sens[f] = {};
  for (const esp of [50, 100]) {
    out.sens[f][esp] = M.LINHAS.map((l) => {
      const r = M.avaliarLinha(l, D, { atual: { ...M.ATUAL_BASE, fatorK: f }, espessuraNovaMm: esp });
      return { dTatual: r.atual.dT, dTnovo: r.novo.dT, perdaAtualKW: r.atual.perdaKW, perdaNovoKW: r.novo.perdaKW, vel: r.vel, nm3h: r.nm3h };
    });
  }
}

// 3) Curva ΔT x espessura (50 a 150 mm, passo 10) — base do gráfico de espessura de equilíbrio
out.grade = [];
for (let esp = 50; esp <= 150; esp += 10) {
  out.grade.push({
    esp,
    linhas: M.LINHAS.map((l) => {
      const r = M.avaliarLinha(l, D, { espessuraNovaMm: esp });
      return { dTatual: r.atual.dT, dTnovo: r.novo.dT };
    }),
  });
}

fs.writeFileSync(`resultados_${tag}.json`, JSON.stringify(out, null, 1));

const f1 = (x) => x.toFixed(1);
console.log(`\n=== D = ${D * 1000} mm ===`);
for (const esp of [50, 75, 100, 125, 150]) {
  for (const r of out.cenarios[esp]) {
    console.log(
      `${r.linha.nome} | novo ${esp} mm: dT ${f1(r.atual.dT)} -> ${f1(r.novo.dT)} °C | perda ${f1(r.atual.perdaKW)} -> ${f1(r.novo.perdaKW)} kW (${f1(r.atual.wm)} -> ${f1(r.novo.wm)} W/m) | m ${r.mKgS.toFixed(2)} kg/s ${r.nm3h.toFixed(0)} Nm3/h v ${f1(r.vel)} m/s | Ts max novo ${f1(r.novo.tsMax)} | dQ ${f1(r.deltaQKw)} kW | ${r.fin.m3Ano.toFixed(0)} m3/ano R$ ${r.fin.reaisAno.toFixed(0)} CO2 ${f1(r.fin.co2TonAno)} t`
    );
  }
}
console.log("\n-- Sensibilidade ao fator de degradação f (novo 50 / 100 mm) --");
for (const f of Object.keys(out.sens)) {
  for (const esp of [50, 100]) {
    console.log(
      `f=${f} novo ${esp}: ` +
        out.sens[f][esp].map((r, i) => `L${i + 1}: ${f1(r.dTatual)}->${f1(r.dTnovo)} (v=${f1(r.vel)} m/s, ${r.nm3h.toFixed(0)} Nm3/h)`).join(" | ")
    );
  }
}
