import { precoAcessorioPorUnidade } from "@/lib/usecases/orcamento/precoAcessorio";
import type { PrecoConfig } from "@/lib/types";

function preco(overrides: Partial<PrecoConfig>): PrecoConfig {
  return {
    id: 1,
    tipo_material: "acessorio_rebite",
    descricao: "Rebite",
    especificacao: null,
    unidade: "centena",
    preco_unitario: 15,
    densidade_kg_m3: null,
    ativo: true,
    ordem: 1,
    ultima_atualizacao: "2026-01-01",
    familia: null,
    espessura_mm: null,
    ...overrides,
  };
}

describe("precoAcessorioPorUnidade", () => {
  it("rebite/parafuso cadastrados por centena viram preço por unidade (÷ 100) — bug relatado: valor inflado 100×", () => {
    // R$15 por centena = R$0,15 por unidade; 2 un. custam R$0,30, não R$30.
    expect(precoAcessorioPorUnidade([preco({ tipo_material: "acessorio_rebite", preco_unitario: 15 })], "acessorio_rebite")).toBeCloseTo(0.15, 5);
    expect(precoAcessorioPorUnidade([preco({ tipo_material: "acessorio_parafuso", preco_unitario: 5 })], "acessorio_parafuso")).toBeCloseTo(0.05, 5);
  });

  it("arame (por metro) e silicone (por frasco) já estão na unidade da quantidade — passam direto", () => {
    expect(precoAcessorioPorUnidade([preco({ tipo_material: "acessorio_arame", unidade: "m", preco_unitario: 0.5 })], "acessorio_arame")).toBe(0.5);
    expect(precoAcessorioPorUnidade([preco({ tipo_material: "acessorio_silicone", unidade: "frasco", preco_unitario: 30 })], "acessorio_silicone")).toBe(30);
  });

  it("acessório não cadastrado dá 0", () => {
    expect(precoAcessorioPorUnidade([], "acessorio_rebite")).toBe(0);
  });
});
