import { comissaoRepresentante, valorBrutoDoLead, valorDoLead } from "@/lib/leads";

const base = { eh_comissao: false, valor_comissao: null, valor_fechado: null as number | null, valor_estimado: 10000, etapa: "proposta" as const };

describe("valor do lead com representante (migração 055)", () => {
  it("Kanban mostra o líquido: proposta menos a comissão do representante", () => {
    const lead = { ...base, representante_id: "r1", percentual_representante: 8 };
    expect(valorBrutoDoLead(lead)).toBe(10000);
    expect(comissaoRepresentante(lead)).toBe(800);
    expect(valorDoLead(lead)).toBe(9200);
  });

  it("fechado usa o valor fechado", () => {
    const lead = { ...base, etapa: "fechado" as const, valor_fechado: 12000, representante_id: "r1", percentual_representante: 10 };
    expect(valorDoLead(lead)).toBe(10800);
  });

  it("venda direta não muda", () => {
    expect(valorDoLead(base)).toBe(10000);
    expect(comissaoRepresentante(base)).toBe(0);
  });
});
