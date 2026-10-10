import { calcularCapacidadeDia, calcularCapacidadeMes, nivelOcupacao } from "@/lib/usecases/operacional";
import type { Parceiro, Servico, ServicoParceiroExecucao } from "@/lib/types/domain";

function execucao(overrides: Partial<ServicoParceiroExecucao> = {}): ServicoParceiroExecucao {
  return {
    id: "e1",
    servico_id: "s1",
    parceiro_id: "p1",
    pessoas_mobilizadas: 5,
    tipos_trabalho: ["bancada"],
    data_adicao: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function parceiro(overrides: Partial<Parceiro> = {}): Parceiro {
  return {
    id: "p1",
    numero_parceiro: "P00001",
    nome: "Suzano",
    razao_social: null,
    email: null,
    telefone: null,
    cnpj: null,
    cep: null,
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
    categoria_parceiro: "prestador",
    notas_bancada: null,
    notas_caldeiraria: null,
    notas_isolador: null,
    notas_funileiro_tracador: null,
    notas_caldeiraria_montagem: null,
    notas_removivel_montagem: null,
    notas_removivel_fabricacao: null,
    notas_ajudante: null,
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
    parceiros_execucao: [execucao({ servico_id: "s1", parceiro_id: "p1", pessoas_mobilizadas: 5 })],
    ...overrides,
  };
}

describe("calcularCapacidadeDia", () => {
  it("soma pessoas_mobilizadas dos parceiros vinculados (parceiros_execucao)", () => {
    const resultado = calcularCapacidadeDia(
      "2026-08-10",
      [parceiro()],
      [
        servico({ id: "s1", parceiros_execucao: [execucao({ servico_id: "s1", parceiro_id: "p1", pessoas_mobilizadas: 5 })] }),
        servico({ id: "s2", parceiros_execucao: [execucao({ servico_id: "s2", parceiro_id: "p1", pessoas_mobilizadas: 3 })] }),
      ]
    );

    expect(resultado.porParceiro[0].pessoasMobilizadas).toBe(8);
    expect(resultado.porParceiro[0].pessoasDisponiveis).toBe(7); // 15 - 8
    expect(resultado.totalMobilizado).toBe(8);
    expect(resultado.totalDisponivel).toBe(15);
    expect(resultado.totalLivre).toBe(7);
  });

  it("conta TODOS os parceiros vinculados a um serviço, não só um 'principal' (modelo pós sql-migration-013)", () => {
    const resultado = calcularCapacidadeDia(
      "2026-08-10",
      [parceiro({ id: "p1" }), parceiro({ id: "p2", nome: "Fibra Co" })],
      [
        servico({
          parceiros_execucao: [
            execucao({ id: "e1", parceiro_id: "p1", pessoas_mobilizadas: 5 }),
            execucao({ id: "e2", parceiro_id: "p2", pessoas_mobilizadas: 2 }),
          ],
        }),
      ]
    );

    const fibraCo = resultado.porParceiro.find((p) => p.parceiroId === "p2");
    expect(fibraCo?.pessoasMobilizadas).toBe(2);
  });

  it("ignora parceiros inativos", () => {
    const resultado = calcularCapacidadeDia("2026-08-10", [parceiro({ ativo: false })], []);
    expect(resultado.porParceiro).toHaveLength(0);
  });

  // Migração 027 — "parceria" pura é só canal de indicação de comissão, não
  // tem gente pra mobilizar: nunca deve aparecer na Agenda/Capacidade.
  it("ignora parceiros de categoria 'parceria' (não fornecem mão de obra)", () => {
    const resultado = calcularCapacidadeDia("2026-08-10", [parceiro({ categoria_parceiro: "parceria" })], []);
    expect(resultado.porParceiro).toHaveLength(0);
  });

  it("inclui parceiros 'ambos' (fornecem mão de obra E recebem indicação)", () => {
    const resultado = calcularCapacidadeDia("2026-08-10", [parceiro({ categoria_parceiro: "ambos" })], []);
    expect(resultado.porParceiro).toHaveLength(1);
  });

  it("serviço sem nenhum parceiro vinculado ainda não mobiliza ninguém", () => {
    const resultado = calcularCapacidadeDia("2026-08-10", [parceiro()], [servico({ parceiros_execucao: [] })]);
    expect(resultado.porParceiro[0].pessoasMobilizadas).toBe(0);
  });

  it("nunca deixa pessoasDisponiveis negativo (superalocação)", () => {
    const resultado = calcularCapacidadeDia(
      "2026-08-10",
      [parceiro({ total_pessoas: 5 })],
      [servico({ parceiros_execucao: [execucao({ pessoas_mobilizadas: 10 })] })]
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
      [servico({ data_inicio: "2026-08-10", data_fim_prevista: "2026-08-12" })]
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

describe("calcularCapacidadeDia — equipe própria (migração 044)", () => {
  const funcionarios = [
    { id: "f1", status: "ativo" as const, tipos_trabalho: ["isolador" as const] },
    { id: "f2", status: "ativo" as const, tipos_trabalho: ["ajudante" as const] },
    { id: "f3", status: "desligado" as const, tipos_trabalho: [] },
  ];
  const alocado = (id: string, funcionarioId: string) => ({ id, servico_id: "s", funcionario_id: funcionarioId, tipos_trabalho: ["ajudante" as const], data_adicao: "" });

  it("cada funcionário ativo é uma pessoa de capacidade; alocado conta como mobilizado", () => {
    const r = calcularCapacidadeDia(
      "2026-10-10",
      [],
      [servico({ id: "s1", funcionarios_execucao: [alocado("e1", "f1")] })],
      funcionarios
    );
    const equipe = r.porParceiro.find((p) => p.parceiroId === "equipe-propria");
    expect(equipe).toMatchObject({ totalPessoas: 2, pessoasMobilizadas: 1, pessoasDisponiveis: 1 });
    expect(equipe?.tiposTrabalho.sort()).toEqual(["ajudante", "isolador"]);
    expect(equipe?.servicos).toHaveLength(1);
    expect(r.totalDisponivel).toBe(2);
    expect(r.totalMobilizado).toBe(1);
  });

  it("a mesma pessoa em duas obras no dia conta uma vez; desligado não entra", () => {
    const r = calcularCapacidadeDia(
      "2026-10-10",
      [],
      [
        servico({ id: "s1", funcionarios_execucao: [alocado("e1", "f1"), alocado("e2", "f3")] }),
        servico({ id: "s2", funcionarios_execucao: [alocado("e3", "f1")] }),
      ],
      funcionarios
    );
    const equipe = r.porParceiro.find((p) => p.parceiroId === "equipe-propria");
    expect(equipe?.pessoasMobilizadas).toBe(1);
    expect(equipe?.servicos.map((s) => s.pessoas)).toEqual([1, 1]);
  });

  it("sem funcionários ativos, a linha da equipe própria não aparece", () => {
    const r = calcularCapacidadeDia("2026-10-10", [], [], [{ id: "f3", status: "desligado", tipos_trabalho: [] }]);
    expect(r.porParceiro).toHaveLength(0);
  });
});
