import { alocarValorFinalPorTrecho, precificarTrecho } from "@/lib/usecases/orcamento/precificarTrecho";
import type { ParametrosMaoObra } from "@/lib/usecases/orcamento/calcularMaoObraAutomatica";
import type { ParametrosQuantificacao } from "@/lib/usecases/orcamento/quantificarMateriais";
import type { ItemEscopo } from "@/lib/types";

function planoDe(metragem: number): ItemEscopo {
  return {
    id: "1",
    nome: "Item",
    tipo: "plano",
    diametro_mm: null,
    comprimento_m: null,
    quantidade: null,
    metragem_manual_m2: metragem,
    metragem_editada: false,
  };
}

// Parâmetros "neutros" — 0% de acréscimo e 0 de acessórios — pra testar só a
// mecânica de precificarTrecho sem a aritmética de quantificarMateriais (que
// já tem seus próprios testes dedicados).
const quantificacaoNeutra: ParametrosQuantificacao = {
  isolante_acrescimo_percentual: 0,
  acabamento_acrescimo_percentual: 0,
  rebite_por_m2: 0,
  parafusos_por_m2: 0,
  arame_gramas_por_m2: 0,
  silicone_intervalo_m2: 0,
};

const maoObraNeutra: ParametrosMaoObra = {
  m2_por_hora_dupla: 1, // 1 m²/hora → horas_base = metragem, sem diluir a conta
  eficiencia_tubulacao_pequena: 0.75,
  eficiencia_curva: 0.75,
  eficiencia_altura: 0.5,
  eficiencia_fator_br: 1, // sem o fator BR aqui pra manter as contas redondas
  horas_uteis_dia: 9,
};

const precosAcessoriosZerados = { rebiteUn: 0, parafusoUn: 0, arameKg: 0, siliconeFrasco: 0 };

describe("precificarTrecho", () => {
  it("subtotal material = (isolante m² × preço) + (acabamento m² × preço), sem acréscimo nem acessórios", () => {
    const resultado = precificarTrecho({
      escopoItens: [planoDe(10)],
      tipoProposta: "material_mo",
      precoIsolanteM2: 50,
      precoAcabamentoM2: 85,
      precosAcessorios: precosAcessoriosZerados,
      valorHoraMaoObra: 120,
      trabalhoAltura: false,
      parametrosQuantificacao: quantificacaoNeutra,
      parametrosMaoObra: maoObraNeutra,
    });

    expect(resultado.metragem_m2).toBe(10);
    expect(resultado.subtotal_material).toBe(1350); // 10 × 135
    expect(resultado.horas_mao_obra).toBe(10); // 10m² / 1m²/h, eficiência 1.0
    expect(resultado.subtotal_mao_obra).toBe(1200); // 10h × 120
    expect(resultado.subtotal_trecho).toBe(2550);
  });

  it("tipo_proposta 'somente_mo' zera o subtotal de material, mão de obra continua normal", () => {
    const resultado = precificarTrecho({
      escopoItens: [planoDe(10)],
      tipoProposta: "somente_mo",
      precoIsolanteM2: 50,
      precoAcabamentoM2: 85,
      precosAcessorios: precosAcessoriosZerados,
      valorHoraMaoObra: 120,
      trabalhoAltura: false,
      parametrosQuantificacao: quantificacaoNeutra,
      parametrosMaoObra: maoObraNeutra,
    });

    expect(resultado.subtotal_material).toBe(0);
    expect(resultado.subtotal_mao_obra).toBe(1200);
    expect(resultado.subtotal_trecho).toBe(1200);
  });

  it("trabalho em altura reduz a eficiência e aumenta as horas (e o custo de mão de obra)", () => {
    const semAltura = precificarTrecho({
      escopoItens: [planoDe(10)],
      tipoProposta: "somente_mo",
      precoIsolanteM2: 0,
      precoAcabamentoM2: 0,
      precosAcessorios: precosAcessoriosZerados,
      valorHoraMaoObra: 100,
      trabalhoAltura: false,
      parametrosQuantificacao: quantificacaoNeutra,
      parametrosMaoObra: maoObraNeutra,
    });
    const comAltura = precificarTrecho({
      escopoItens: [planoDe(10)],
      tipoProposta: "somente_mo",
      precoIsolanteM2: 0,
      precoAcabamentoM2: 0,
      precosAcessorios: precosAcessoriosZerados,
      valorHoraMaoObra: 100,
      trabalhoAltura: true,
      parametrosQuantificacao: quantificacaoNeutra,
      parametrosMaoObra: maoObraNeutra,
    });

    expect(comAltura.eficiencia_global).toBe(0.5);
    expect(comAltura.horas_mao_obra).toBeGreaterThan(semAltura.horas_mao_obra);
    expect(comAltura.subtotal_mao_obra).toBeGreaterThan(semAltura.subtotal_mao_obra);
  });

  it("sem itens de escopo, subtotal material e mão de obra são zero", () => {
    const resultado = precificarTrecho({
      escopoItens: [],
      tipoProposta: "material_mo",
      precoIsolanteM2: 50,
      precoAcabamentoM2: 85,
      precosAcessorios: precosAcessoriosZerados,
      valorHoraMaoObra: 120,
      trabalhoAltura: false,
      parametrosQuantificacao: quantificacaoNeutra,
      parametrosMaoObra: maoObraNeutra,
    });
    expect(resultado.subtotal_material).toBe(0);
    expect(resultado.subtotal_trecho).toBe(0);
  });
});

describe("alocarValorFinalPorTrecho", () => {
  it("reparte proporcionalmente ao custo de cada trecho e soma exatamente o valor final", () => {
    const trechos = [
      { subtotal_material: 8505, subtotal_mao_obra: 1440 }, // custo 9945
      { subtotal_material: 4600, subtotal_mao_obra: 960 }, // custo 5560
    ];
    const valores = alocarValorFinalPorTrecho(trechos, 18606);

    expect(valores).toHaveLength(2);
    const soma = Number((valores[0] + valores[1]).toFixed(2));
    expect(soma).toBe(18606);
    // Trecho 1 tem custo maior (9945 vs 5560) — deve receber mais que a metade.
    expect(valores[0]).toBeGreaterThan(valores[1]);
  });

  it("custo total zero não gera divisão por zero — todos os trechos recebem 0", () => {
    const trechos = [
      { subtotal_material: 0, subtotal_mao_obra: 0 },
      { subtotal_material: 0, subtotal_mao_obra: 0 },
    ];
    expect(alocarValorFinalPorTrecho(trechos, 1000)).toEqual([0, 0]);
  });

  it("um único trecho recebe o valor final inteiro", () => {
    const trechos = [{ subtotal_material: 100, subtotal_mao_obra: 0 }];
    expect(alocarValorFinalPorTrecho(trechos, 250.5)).toEqual([250.5]);
  });
});
