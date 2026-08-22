import { funilLeads } from "@/lib/usecases/resumo";

function criarLeadRepoFake(linhas: Array<{ etapa: string; total: number; valor_total: number }>) {
  return { porEtapaView: jest.fn(async () => linhas) };
}

describe("funilLeads", () => {
  it("calcula retenção percentual entre etapas consecutivas", async () => {
    const leadRepo = criarLeadRepoFake([
      { etapa: "prospeccao", total: 45, valor_total: 450_000 },
      { etapa: "contato", total: 20, valor_total: 200_000 },
      { etapa: "proposta", total: 8, valor_total: 80_000 },
      { etapa: "negociacao", total: 3, valor_total: 30_000 },
      { etapa: "fechado", total: 1, valor_total: 10_000 },
    ]);

    const resultado = await funilLeads(leadRepo as never);

    expect(resultado.etapas[0].retencaoPercentual).toBeNull(); // primeira etapa não tem "anterior"
    expect(resultado.etapas[1].retencaoPercentual).toBeCloseTo((20 / 45) * 100, 5);
    expect(resultado.etapas[2].retencaoPercentual).toBeCloseTo((8 / 20) * 100, 5);
  });

  it("identifica a maior queda percentual como gargalo", async () => {
    // quedas: contato 55.6%, proposta 60%, negociação 62.5%, fechado 66.7%
    // (cada etapa reduz a retenção da anterior) — a maior é negociação -> fechado
    const leadRepo = criarLeadRepoFake([
      { etapa: "prospeccao", total: 45, valor_total: 0 },
      { etapa: "contato", total: 20, valor_total: 0 },
      { etapa: "proposta", total: 8, valor_total: 0 },
      { etapa: "negociacao", total: 3, valor_total: 0 },
      { etapa: "fechado", total: 1, valor_total: 0 },
    ]);

    const resultado = await funilLeads(leadRepo as never);

    expect(resultado.gargalo).not.toBeNull();
    expect(resultado.gargalo!.deEtapa).toBe("Negociação");
    expect(resultado.gargalo!.paraEtapa).toBe("Fechado");
    expect(resultado.gargalo!.quedaPercentual).toBeCloseTo(66.7, 1);
  });

  it("etapa seguinte zerada conta como gargalo real (queda de 100%)", async () => {
    // 10 leads em prospecção, nenhum avançou pra contato — é o pior gargalo
    // possível, o cálculo deve sinalizar isso, não descartar por "não ter dado".
    const leadRepo = criarLeadRepoFake([{ etapa: "prospeccao", total: 10, valor_total: 100 }]);

    const resultado = await funilLeads(leadRepo as never);

    expect(resultado.etapas.map((e) => e.quantidade)).toEqual([10, 0, 0, 0, 0]);
    expect(resultado.gargalo).toEqual({ deEtapa: "Prospecção", paraEtapa: "Contato", quedaPercentual: 100 });
  });

  it("retorna null pra gargalo quando não há dado suficiente (funil vazio)", async () => {
    const leadRepo = criarLeadRepoFake([]);
    const resultado = await funilLeads(leadRepo as never);
    expect(resultado.gargalo).toBeNull();
  });
});
