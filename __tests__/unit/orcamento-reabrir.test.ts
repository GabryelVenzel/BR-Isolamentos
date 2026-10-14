import { estadoWizardValido, reconstruirEstadoWizard } from "@/lib/usecases/orcamento/reabrirOrcamento";
import type { ConfigEmpresa, ItemOrcamento, Orcamento, PrecoConfig } from "@/lib/types";

const config = {
  valor_km_deslocamento: 0.5,
  valor_noite_hospedagem: 200,
  valor_diaria_aluguel_carro: 150,
  valor_diaria_alimentacao: 40,
  margem_lucro_padrao: 40,
  valor_diaria_funileiro: 550,
  valor_diaria_isolador: 550,
  valor_diaria_ajudante: 300,
  m2_dia_funileiro: 3.5,
  m2_dia_isolador: 3.5,
  m2_dia_ajudante: 3,
  horas_uteis_dia: 7,
} as ConfigEmpresa;

function item(dados: Partial<ItemOrcamento> = {}): ItemOrcamento {
  return {
    id: 7,
    orcamento_id: 1,
    ordem: 0,
    tipo_trabalho: "quente",
    escopo_itens: [{ id: "a", nome: "Parede", tipo: "plano", diametro_mm: null, comprimento_m: null, quantidade: null, metragem_manual_m2: 60, metragem_editada: false }],
    material: "Lã de Rocha 64kg/m³",
    acabamento: "Alumínio 0,5mm",
    temperatura_quente: 200,
    temperatura_ambiente: 30,
    geometria: "plana",
    area_m2: 60,
    trabalho_altura: true,
    eficiencia_global: 0.8,
    espessura_necessaria_mm: 50,
    temperatura_face_fria: 45,
    perda_com_isolante: 0.1,
    perda_sem_isolante: 2,
    economia_anual: 12000,
    co2_ton_ano: 3,
    preco_isolante_m2: 10,
    preco_acabamento_m2: 5,
    horas_mao_obra: 50,
    subtotal_material: 2490,
    subtotal_mao_obra: 14400,
    detalhamento_materiais: [
      { chave: "isolante", titulo: "Lã de Rocha 64kg/m³", quantidade: 72, unidade: "m²", preco_unitario: 10, subtotal: 720 },
      { chave: "acabamento", titulo: "Alumínio 0,5mm", quantidade: 78, unidade: "m²", preco_unitario: 5, subtotal: 390 },
      { chave: "rebite", titulo: "Rebite", quantidade: 2400, unidade: "un.", preco_unitario: 0.15, subtotal: 360 },
      { chave: "item_adicional_execucao", titulo: "Andaime", quantidade: 2, unidade: "un.", preco_unitario: 600, subtotal: 1200 },
    ],
    valor_materiais: 2490,
    ...dados,
  } as ItemOrcamento;
}

function orcamento(dados: Partial<Orcamento> = {}): Orcamento {
  return {
    id: 1,
    numero: "ORC-2026-0001",
    cliente_id: 1,
    tipo_trabalho: "quente",
    tipo_proposta: "material_mo",
    valor_materiais: 2490,
    valor_mao_obra: 14400,
    valor_deslocamento: 50,
    valor_hospedagem: 0,
    valor_frete: 300,
    valor_aluguel_carro: 0,
    valor_alimentacao: 880,
    subtotal: 18120,
    detalhamento_impostos: [{ nome: "Simples", percentual: 8, valor: 0 }],
    total_impostos: 0,
    margem_lucro: 0,
    valor_desconto: 500,
    // custo 18120 ÷ (1 − 0,08 − 0,30) = 29225,81 → margem usada 30%
    preco_cheio: 29225.81,
    valor_final: 28725.81,
    horas_uteis_dia: null,
    status: "proposta",
    observacoes_adicionais: "Obs",
    mao_obra_equipe: {
      m2_equivalente: 75,
      producao_m2_dia: 10.5,
      horas_obra: 50,
      horas_uteis_dia: 7,
      dias: 8,
      dias_manual: false,
      pessoas: 3,
      funcoes: [
        { funcao: "funileiro", pessoas: 2, m2_dia: 3.5, valor_diaria: 550, diarias: 8, subtotal: 8800 },
        { funcao: "isolador", pessoas: 1, m2_dia: 3.5, valor_diaria: 600, diarias: 8, subtotal: 4800 },
      ],
      valor_total: 13600,
    },
    itens: [item()],
    ...dados,
  } as Orcamento;
}

describe("reconstruirEstadoWizard — reabrir um orçamento salvo no wizard", () => {
  it("recupera equipe, diária ajustada, custos (valor → quantidade), margem usada, desconto e observações", () => {
    const { estado } = reconstruirEstadoWizard(orcamento(), config, []);

    expect(estado.equipe).toEqual({ funileiro: 2, isolador: 1, ajudante: 0, tst: 0 });
    // só a diária que difere da configuração vira ajuste do orçamento
    expect(estado.valoresDiariaOverride).toEqual({ isolador: 600 });
    expect(estado.diasMaoObraManual).toBeNull();
    expect(estado.custosOperacionais).toMatchObject({ km_deslocamento: 100, quantidade_alimentacao: 22, noites_hospedagem: 0, diarias_aluguel_carro: 0, valor_frete: 300 });
    expect(estado.margemPercentual).toBe(30);
    expect(estado.descontoValor).toBe(500);
    expect(estado.observacoes).toBe("Obs");
  });

  it("margem igual à padrão não vira ajuste (fica em branco na tela)", () => {
    // 18120 ÷ (1 − 0,08 − 0,40) = 34846,15
    const { estado } = reconstruirEstadoWizard(orcamento({ preco_cheio: 34846.15, valor_desconto: 0 }), config, []);
    expect(estado.margemPercentual).toBeNull();
  });

  it("trecho: escopo, especificações, resultado térmico e valores salvos voltam como estavam", () => {
    const trecho = reconstruirEstadoWizard(orcamento(), config, []).estado.itens[0];

    expect(trecho.escopoItens).toHaveLength(1);
    expect(trecho.especificacoes).toMatchObject({ tipo_trabalho: "quente", trabalho_altura: true, espessura_mm: 50, temperatura_quente: 200, temperatura_ambiente: 30 });
    // material fora do catálogo volta como "outro material", com o preço salvo
    expect(trecho.especificacoes).toMatchObject({ preco_isolante_id: null, isolante_customizado_nome: "Lã de Rocha 64kg/m³", isolante_customizado_preco_m2: 10 });
    expect(trecho.resultadoTermicoQuente).toMatchObject({ temperatura_face_fria: 45, perda_com_isolante_kw_m2: 0.1, financeiro: { economia_anual: 12000, co2_ton_ano: 3 } });
    expect(trecho.precificacao).toMatchObject({ metragem_m2: 60, m2_equivalente_mao_obra: 75, subtotal_material: 2490, subtotal_itens_execucao: 1200, eficiencia_global: 0.8 });
  });

  it("ajustes: materiais salvos viram lápis, os ausentes viram linha excluída e os itens adicionais voltam", () => {
    const { ajustes } = reconstruirEstadoWizard(orcamento(), config, []).estado.itens[0];

    expect(ajustes?.overrides.rebite).toEqual({ quantidade: 2400, precoUnitario: 0.15, unidade: "un." });
    expect(ajustes?.overrides.arame).toEqual({ quantidade: 0, removida: true });
    expect(ajustes?.itensAdicionais).toEqual([expect.objectContaining({ nome: "Andaime", quantidade: 2, precoUnitario: 600, categoria: "execucao" })]);
  });

  it("material que ainda existe no catálogo volta ligado a ele", () => {
    const precos = [{ id: 31, tipo_material: "isolante_la_rocha", descricao: "Lã de Rocha 64kg/m³", ativo: true }] as unknown as PrecoConfig[];
    const { especificacoes } = reconstruirEstadoWizard(orcamento(), config, precos).estado.itens[0];
    expect(especificacoes.preco_isolante_id).toBe(31);
    expect(especificacoes.isolante_customizado_nome).toBeNull();
  });

  it("orçamento anterior à equipe e diárias: vira a dupla equivalente, mantendo o valor de mão de obra salvo", () => {
    // 14.400 salvos, dos quais 1.200 são andaime → 13.200 de mão de obra; 50 h em dias de 10 h = 5 dias
    const { estado, avisos } = reconstruirEstadoWizard(orcamento({ mao_obra_equipe: null, horas_uteis_dia: 10 }), config, []);
    expect(estado.equipe).toEqual({ funileiro: 1, isolador: 1, ajudante: 0, tst: 0 });
    expect(estado.diasMaoObraManual).toBe(5);
    expect(estado.valoresDiariaOverride).toEqual({ funileiro: 1320, isolador: 1320 });
    // 2 pessoas × 5 dias × 1.320 = 13.200 — o mesmo valor salvo
    expect(2 * 5 * 1320).toBe(13200);
    // as horas úteis antigas eram do modelo de horas da dupla — não viram ajuste do orçamento
    expect(estado.horasUteisDiaOverride).toBeNull();
    expect(avisos.some((a) => a.includes("anterior ao formato de equipe e diárias") && a.includes("5 dias"))).toBe(true);
  });

  it("orçamento antigo sem mão de obra volta com a equipe zerada", () => {
    const semMaoObra = orcamento({ mao_obra_equipe: null, valor_mao_obra: 1200, itens: [item({ horas_mao_obra: 0, subtotal_mao_obra: 1200 })] });
    const { estado } = reconstruirEstadoWizard(semMaoObra, config, []);
    expect(estado.equipe).toEqual({ funileiro: 0, isolador: 0, ajudante: 0, tst: 0 });
    expect(estado.diasMaoObraManual).toBeNull();
  });

  it("avisa quando o rendimento configurado mudou desde a criação", () => {
    const { avisos } = reconstruirEstadoWizard(orcamento(), { ...config, m2_dia_funileiro: 5 }, []);
    expect(avisos.some((a) => a.includes("rendimento das funções"))).toBe(true);
  });

  it("trecho sem escopo salvo (orçamento muito antigo) ganha um item com a metragem do trecho", () => {
    const trecho = reconstruirEstadoWizard(orcamento({ itens: [item({ escopo_itens: [] })] }), config, []).estado.itens[0];
    expect(trecho.escopoItens).toEqual([expect.objectContaining({ tipo: "plano", metragem_manual_m2: 60 })]);
  });
});

describe("estadoWizardValido", () => {
  it("aceita a cópia no formato atual e recusa o resto", () => {
    const { estado } = reconstruirEstadoWizard(orcamento(), config, []);
    expect(estadoWizardValido(estado)).toBe(true);
    expect(estadoWizardValido(null)).toBe(false);
    expect(estadoWizardValido({ versao: 2, itens: [] })).toBe(false);
    expect(estadoWizardValido({ ...estado, itens: [] })).toBe(false);
  });
});
