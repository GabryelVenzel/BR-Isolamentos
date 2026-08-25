import { calcularCapacidadeDia, calcularCapacidadeMes, nivelOcupacao } from "@/lib/usecases/operacional";
import type { Parceiro, Servico } from "@/lib/types/domain";

function parceiro(overrides: Partial<Parceiro> = {}): Parceiro {
  return {
    id: "p1",
    numero_parceiro: "P00001",
    nome: "Suzano",
    email: null,
    telefone: null,
    cnpj: null,
    endereco: null,
    cidade: null,
    estado: null,
    cpf: null,
    conta_bancaria: null,
    especialidades: [],
    disponibilidade_horas_semana: null,
    disponibilidade_dias: [],
    custo_hora: null,
    tipos_trabalho: ["bancada"],
    notas_bancada: null,
    notas_caldeiraria: null,
    notas_isolamentos_removiveis: null,
    notas_isolamentos_fixos: null,
    total_pessoas: 15,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function servico(overrides: Partial<Servico> = {}): Servico {
  return {
    id: "s1",
    numero_servico: "S00001",
    lead_id: null,
    numero_lead: null,
    orcamento_id: null,
    numero_orcamento: null,
    cliente_id: null,
    etapa: "execucao",
    tipo_trabalho: "bancada",
    tipos_trabalho: ["bancada"],
    valor_orcado: null,
    valor_real: null,
    data_inicio: "2026-08-01",
    data_fim_prevista: "2026-08-20",
    data_fim_real: null,
    parceiro_principal_id: "p1",
    pessoas_alocadas: 5,
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

describe("calcularCapacidadeDia", () => {
  it("soma pessoas_alocadas dos serviços do parceiro principal", () => {
    const resultado = calcularCapacidadeDia(
      "2026-08-10",
      [parceiro()],
      [servico({ id: "s1", pessoas_alocadas: 5 }), servico({ id: "s2", pessoas_alocadas: 3 })]
    );

    expect(resultado.porParceiro[0].pessoasMobilizadas).toBe(8);
    expect(resultado.porParceiro[0].pessoasDisponiveis).toBe(7); // 15 - 8
    expect(resultado.totalMobilizado).toBe(8);
    expect(resultado.totalDisponivel).toBe(15);
    expect(resultado.totalLivre).toBe(7);
  });

  it("ignora parceiros de apoio (parceiros_alocados) — só parceiro_principal_id conta headcount", () => {
    const resultado = calcularCapacidadeDia(
      "2026-08-10",
      [parceiro({ id: "p1" }), parceiro({ id: "p2", nome: "Fibra Co" })],
      [servico({ parceiro_principal_id: "p1", pessoas_alocadas: 5, parceiros_alocados: ["p2"] })]
    );

    const fibraCo = resultado.porParceiro.find((p) => p.parceiroId === "p2");
    expect(fibraCo?.pessoasMobilizadas).toBe(0);
  });

  it("ignora parceiros inativos", () => {
    const resultado = calcularCapacidadeDia("2026-08-10", [parceiro({ ativo: false })], []);
    expect(resultado.porParceiro).toHaveLength(0);
  });

  it("nunca deixa pessoasDisponiveis negativo (superalocação)", () => {
    const resultado = calcularCapacidadeDia(
      "2026-08-10",
      [parceiro({ total_pessoas: 5 })],
      [servico({ pessoas_alocadas: 10 })]
    );
    expect(resultado.porParceiro[0].pessoasDisponiveis).toBe(0);
  });

  it("parceiro sem total_pessoas cadastrado conta como capacidade zero", () => {
    const resultado = calcularCapacidadeDia("2026-08-10", [parceiro({ total_pessoas: null })], []);
    expect(resultado.porParceiro[0].totalPessoas).toBe(0);
  });
});

describe("nivelOcupacao", () => {
  it("livre até 70% mobilizado", () => {
    expect(nivelOcupacao(15, 0)).toBe("livre");
    expect(nivelOcupacao(15, 10)).toBe("livre"); // 66.7%
  });

  it("atencao entre 70% e 90% mobilizado", () => {
    expect(nivelOcupacao(15, 11)).toBe("atencao"); // 73.3%
    expect(nivelOcupacao(15, 13)).toBe("atencao"); // 86.7%
  });

  it("critico acima de 90% mobilizado", () => {
    expect(nivelOcupacao(15, 14)).toBe("critico"); // 93.3%
    expect(nivelOcupacao(15, 15)).toBe("critico");
  });

  it("sem capacidade nenhuma (totalDisponivel 0) é livre, não um alerta falso", () => {
    expect(nivelOcupacao(0, 0)).toBe("livre");
  });
});

describe("calcularCapacidadeMes", () => {
  it("gera um resumo por cada dia do mês", () => {
    const resultado = calcularCapacidadeMes(2026, 8, [parceiro()], []);
    expect(resultado).toHaveLength(31); // agosto tem 31 dias
    expect(resultado[0].data).toBe("2026-08-01");
    expect(resultado[30].data).toBe("2026-08-31");
  });

  it("só conta o serviço nos dias dentro do seu período de execução", () => {
    const resultado = calcularCapacidadeMes(
      2026,
      8,
      [parceiro()],
      [servico({ data_inicio: "2026-08-10", data_fim_prevista: "2026-08-12", pessoas_alocadas: 5 })]
    );
    const dia9 = resultado.find((d) => d.data === "2026-08-09");
    const dia11 = resultado.find((d) => d.data === "2026-08-11");
    const dia13 = resultado.find((d) => d.data === "2026-08-13");

    expect(dia9?.totalMobilizado).toBe(0);
    expect(dia11?.totalMobilizado).toBe(5);
    expect(dia13?.totalMobilizado).toBe(0);
  });

  it("respeita o número de dias de fevereiro (mês menor)", () => {
    const resultado = calcularCapacidadeMes(2026, 2, [parceiro()], []);
    expect(resultado).toHaveLength(28); // 2026 não é bissexto
  });
});
