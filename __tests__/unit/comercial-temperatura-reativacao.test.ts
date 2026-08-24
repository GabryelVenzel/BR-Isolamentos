import { ConflictError, NotFoundError } from "@/lib/errors";
import { mudarTemperatura, reativarLeadFrio } from "@/lib/usecases/comercial";
import type { AgendamentoLeadFrio, ConfigReativacaoLeadsFrios, Lead } from "@/lib/types/domain";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    numero_lead: null,
    cliente_id: 1,
    etapa: "contato",
    temperatura: "morno",
    valor_estimado: 1000,
    origem: null,
    proxima_acao: null,
    data_proxima_acao: null,
    notas: null,
    atribuido_a: null,
    tags: [],
    orcamento_id: null,
    etapa_anterior: null,
    temperatura_anterior: null,
    data_ultima_interacao: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function config(overrides: Partial<ConfigReativacaoLeadsFrios> = {}): ConfigReativacaoLeadsFrios {
  return {
    id: 1,
    dias_prospeccao: 15,
    dias_contato: 20,
    dias_proposta: 30,
    dias_negociacao: 40,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function criarLeadRepoFake(inicial: Lead) {
  let estado = inicial;
  return {
    findById: jest.fn(async () => estado),
    update: jest.fn(async (_id: string, dados: Partial<Lead>) => {
      estado = { ...estado, ...dados };
      return estado;
    }),
  };
}

function criarHistoricoRepoFake() {
  return { create: jest.fn(async (dados: unknown) => dados) };
}

describe("mudarTemperatura", () => {
  it("virar 'frio' agenda reativação usando o prazo configurado para a etapa atual", async () => {
    const leadRepo = criarLeadRepoFake(lead({ etapa: "contato", temperatura: "morno" }));
    const historicoRepo = criarHistoricoRepoFake();
    const agendamentoFrioRepo = { create: jest.fn(async (dados: unknown) => dados) };
    const configReativacaoRepo = { obter: jest.fn(async () => config()) };

    const { agendamento } = await mudarTemperatura(
      { leadId: "l1", novaTemperatura: "frio" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, agendamentoFrioRepo: agendamentoFrioRepo as never, configReativacaoRepo: configReativacaoRepo as never }
    );

    expect(agendamento).not.toBeNull();
    expect((agendamento as unknown as { intervalo_dias: number }).intervalo_dias).toBe(20); // dias_contato
  });

  it("respeita o prazo customizado quando informado, ignorando o padrão da etapa", async () => {
    const leadRepo = criarLeadRepoFake(lead({ etapa: "prospeccao" }));
    const historicoRepo = criarHistoricoRepoFake();
    const agendamentoFrioRepo = { create: jest.fn(async (dados: unknown) => dados) };
    const configReativacaoRepo = { obter: jest.fn(async () => config()) };

    const { agendamento } = await mudarTemperatura(
      { leadId: "l1", novaTemperatura: "frio", intervaloDiasCustom: 7 },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, agendamentoFrioRepo: agendamentoFrioRepo as never, configReativacaoRepo: configReativacaoRepo as never }
    );

    expect((agendamento as unknown as { intervalo_dias: number }).intervalo_dias).toBe(7);
  });

  it("não agenda nada ao mudar para 'morno' ou 'quente'", async () => {
    const leadRepo = criarLeadRepoFake(lead({ temperatura: "frio" }));
    const historicoRepo = criarHistoricoRepoFake();
    const agendamentoFrioRepo = { create: jest.fn() };
    const configReativacaoRepo = { obter: jest.fn() };

    const { agendamento } = await mudarTemperatura(
      { leadId: "l1", novaTemperatura: "quente" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, agendamentoFrioRepo: agendamentoFrioRepo as never, configReativacaoRepo: configReativacaoRepo as never }
    );

    expect(agendamento).toBeNull();
    expect(agendamentoFrioRepo.create).not.toHaveBeenCalled();
  });

  it("é idempotente: mesma temperatura não agenda nem grava histórico", async () => {
    const leadRepo = criarLeadRepoFake(lead({ temperatura: "morno" }));
    const historicoRepo = criarHistoricoRepoFake();
    const agendamentoFrioRepo = { create: jest.fn() };
    const configReativacaoRepo = { obter: jest.fn() };

    await mudarTemperatura(
      { leadId: "l1", novaTemperatura: "morno" },
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, agendamentoFrioRepo: agendamentoFrioRepo as never, configReativacaoRepo: configReativacaoRepo as never }
    );

    expect(leadRepo.update).not.toHaveBeenCalled();
    expect(historicoRepo.create).not.toHaveBeenCalled();
  });
});

describe("reativarLeadFrio", () => {
  function criarAgendamentoRepoFake(inicial: AgendamentoLeadFrio) {
    let estado = inicial;
    return {
      findById: jest.fn(async () => estado),
      marcarReativado: jest.fn(async () => {
        estado = { ...estado, status: "reativado" };
        return estado;
      }),
    };
  }

  const agendamentoBase: AgendamentoLeadFrio = {
    id: "a1",
    lead_id: "l1",
    temperatura_anterior: "morno",
    etapa_anterior: "negociacao",
    data_agendamento: "2026-01-01T00:00:00Z",
    data_retorno: "2026-01-21T00:00:00Z",
    intervalo_dias: 20,
    status: "agendado",
    motivo_cancelamento: null,
    created_at: "2026-01-01T00:00:00Z",
    reativado_em: null,
  };

  it("volta temperatura para Morno e etapa para Contato, qualquer que fosse a etapa anterior", async () => {
    const leadRepo = criarLeadRepoFake(lead({ etapa: "negociacao", temperatura: "frio" }));
    const historicoRepo = criarHistoricoRepoFake();
    const agendamentoFrioRepo = criarAgendamentoRepoFake(agendamentoBase);

    const resultado = await reativarLeadFrio(
      "a1",
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, agendamentoFrioRepo: agendamentoFrioRepo as never },
      "socio@brisolamentos.com",
      true
    );

    expect(resultado.temperatura).toBe("morno");
    expect(resultado.etapa).toBe("contato");
    expect(agendamentoFrioRepo.marcarReativado).toHaveBeenCalledWith("a1");
    expect(historicoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_mudanca: "reativacao_manual", usuario_email: "socio@brisolamentos.com" })
    );
  });

  it("marca 'reativacao_automatica' quando manual = false", async () => {
    const leadRepo = criarLeadRepoFake(lead());
    const historicoRepo = criarHistoricoRepoFake();
    const agendamentoFrioRepo = criarAgendamentoRepoFake(agendamentoBase);

    await reativarLeadFrio(
      "a1",
      { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, agendamentoFrioRepo: agendamentoFrioRepo as never },
      null,
      false
    );

    expect(historicoRepo.create).toHaveBeenCalledWith(expect.objectContaining({ tipo_mudanca: "reativacao_automatica" }));
  });

  it("rejeita reativar um agendamento que já foi reativado ou cancelado", async () => {
    const leadRepo = criarLeadRepoFake(lead());
    const historicoRepo = criarHistoricoRepoFake();
    const agendamentoFrioRepo = criarAgendamentoRepoFake({ ...agendamentoBase, status: "reativado" });

    await expect(
      reativarLeadFrio(
        "a1",
        { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, agendamentoFrioRepo: agendamentoFrioRepo as never },
        null,
        true
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("lança NotFoundError se o agendamento não existe", async () => {
    const leadRepo = criarLeadRepoFake(lead());
    const historicoRepo = criarHistoricoRepoFake();
    const agendamentoFrioRepo = { findById: jest.fn(async () => null), marcarReativado: jest.fn() };

    await expect(
      reativarLeadFrio(
        "inexistente",
        { leadRepo: leadRepo as never, historicoRepo: historicoRepo as never, agendamentoFrioRepo: agendamentoFrioRepo as never },
        null,
        true
      )
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
