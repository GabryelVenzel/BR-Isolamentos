import {
  calcularCustoRealVsOrcado,
  calcularFunilServicos,
  calcularKpisOperacional,
  calcularServicosVencidos,
  calcularTempoExecucaoPorTipo,
} from "@/lib/usecases/operacional";
import type { Servico } from "@/lib/types/domain";

function servico(overrides: Partial<Servico> = {}): Servico {
  return {
    id: "s1",
    numero_servico: "S00001",
    lead_id: null,
    numero_lead: null,
    orcamento_id: null,
    numero_orcamento: null,
    cliente_id: null,
    etapa: "planejamento",
    tipo_trabalho: "bancada",
    valor_orcado: null,
    valor_real: null,
    data_inicio: null,
    data_fim_prevista: null,
    data_fim_real: null,
    parceiro_principal_id: null,
    pessoas_alocadas: null,
    parceiros_alocados: [],
    descricao: null,
    notas: null,
    foto_principal_url: null,
    fotos_url: [],
    pdf_relatorio_url: null,
    responsavel_email: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("calcularKpisOperacional", () => {
  it("conta serviços por etapa e calcula taxa de conclusão", () => {
    const servicos = [
      servico({ id: "1", etapa: "finalizado" }),
      servico({ id: "2", etapa: "execucao" }),
      servico({ id: "3", etapa: "planejamento" }),
      servico({ id: "4", etapa: "planejamento" }),
    ];
    const kpis = calcularKpisOperacional(servicos);
    expect(kpis.servicosConcluidos).toBe(1);
    expect(kpis.servicosEmProgresso).toBe(1);
    expect(kpis.servicosPlanejados).toBe(2);
    expect(kpis.taxaConclusaoPercentual).toBe(25);
  });

  it("tempo médio de execução usa data_inicio até data_fim_real, só de finalizados", () => {
    const servicos = [
      servico({ id: "1", etapa: "finalizado", data_inicio: "2026-01-01", data_fim_real: "2026-01-06" }), // 5 dias
      servico({ id: "2", etapa: "finalizado", data_inicio: "2026-01-01", data_fim_real: "2026-01-11" }), // 10 dias
      servico({ id: "3", etapa: "execucao", data_inicio: "2026-01-01" }), // não conta, não finalizado
    ];
    expect(calcularKpisOperacional(servicos).tempoMedioExecucaoDias).toBeCloseTo(7.5, 5);
  });

  it("custo real vs orçado é null quando não há dados suficientes", () => {
    const kpis = calcularKpisOperacional([servico({ etapa: "finalizado", valor_orcado: null, valor_real: null })]);
    expect(kpis.custoRealVsOrcadoPercentual).toBeNull();
  });

  it("custo real vs orçado calcula percentual agregado", () => {
    const servicos = [
      servico({ id: "1", etapa: "finalizado", valor_orcado: 1000, valor_real: 1100 }),
      servico({ id: "2", etapa: "finalizado", valor_orcado: 1000, valor_real: 900 }),
    ];
    expect(calcularKpisOperacional(servicos).custoRealVsOrcadoPercentual).toBeCloseTo(100, 5); // 2000 real / 2000 orçado
  });
});

describe("calcularFunilServicos", () => {
  it("retenção é null na primeira etapa e calculada nas seguintes", () => {
    const servicos = [
      servico({ id: "1", etapa: "planejamento" }),
      servico({ id: "2", etapa: "planejamento" }),
      servico({ id: "3", etapa: "execucao" }),
      servico({ id: "4", etapa: "finalizado" }),
    ];
    const funil = calcularFunilServicos(servicos);
    expect(funil[0].retencaoPercentual).toBeNull();
    expect(funil[1].retencaoPercentual).toBe(50); // 1 execucao / 2 planejamento
    expect(funil[2].retencaoPercentual).toBe(100); // 1 finalizado / 1 execucao
  });
});

describe("calcularTempoExecucaoPorTipo", () => {
  it("agrupa por tipo de trabalho e calcula dias realizado vs orçado", () => {
    const servicos = [
      servico({
        id: "1",
        etapa: "finalizado",
        tipo_trabalho: "bancada",
        data_inicio: "2026-01-01",
        data_fim_prevista: "2026-01-07", // 6 dias orçado
        data_fim_real: "2026-01-06", // 5 dias realizado
      }),
    ];
    const resultado = calcularTempoExecucaoPorTipo(servicos);
    expect(resultado[0].tipoTrabalho).toBe("bancada");
    expect(resultado[0].diasRealizado).toBeCloseTo(5, 5);
    expect(resultado[0].diasOrcado).toBeCloseTo(6, 5);
  });

  it("ignora serviços não finalizados ou sem tipo de trabalho", () => {
    const resultado = calcularTempoExecucaoPorTipo([servico({ etapa: "execucao", tipo_trabalho: "bancada" })]);
    expect(resultado).toHaveLength(0);
  });
});

describe("calcularCustoRealVsOrcado", () => {
  it("soma orçado/real só de serviços finalizados com os dois valores", () => {
    const servicos = [
      servico({ id: "1", etapa: "finalizado", valor_orcado: 1000, valor_real: 1200, tipo_trabalho: "bancada" }),
      servico({ id: "2", etapa: "execucao", valor_orcado: 500, valor_real: 500 }), // não finalizado, ignorado
    ];
    const resultado = calcularCustoRealVsOrcado(servicos);
    expect(resultado.totalOrcado).toBe(1000);
    expect(resultado.totalReal).toBe(1200);
    expect(resultado.variancePercentual).toBeCloseTo(20, 5);
    expect(resultado.porTipo).toEqual([{ tipoTrabalho: "bancada", orcado: 1000, real: 1200 }]);
  });
});

describe("calcularServicosVencidos", () => {
  it("identifica serviços não finalizados com data_fim_prevista no passado", () => {
    const agora = new Date("2026-08-30T00:00:00Z");
    const servicos = [
      servico({ id: "1", etapa: "execucao", data_fim_prevista: "2026-08-25" }), // 5 dias atrasado
      servico({ id: "2", etapa: "planejamento", data_fim_prevista: "2026-09-01" }), // ainda não venceu
      servico({ id: "3", etapa: "finalizado", data_fim_prevista: "2026-08-01" }), // finalizado, não conta
    ];
    const vencidos = calcularServicosVencidos(servicos, agora);
    expect(vencidos).toHaveLength(1);
    expect(vencidos[0].servico.id).toBe("1");
    expect(vencidos[0].diasAtraso).toBe(5);
  });

  it("ordena do mais atrasado pro menos atrasado", () => {
    const agora = new Date("2026-08-30T00:00:00Z");
    const servicos = [
      servico({ id: "pouco", etapa: "execucao", data_fim_prevista: "2026-08-28" }),
      servico({ id: "muito", etapa: "execucao", data_fim_prevista: "2026-08-10" }),
    ];
    const vencidos = calcularServicosVencidos(servicos, agora);
    expect(vencidos.map((v) => v.servico.id)).toEqual(["muito", "pouco"]);
  });
});
