import { calcularMaoObraPorItens, type ParametrosMaoObra } from "@/lib/usecases/orcamento/calcularMaoObraAutomatica";
import { escopoContemplado, quadrosQuantificacao } from "@/lib/usecases/orcamento/analiseProposta";
import {
  catalogoItensExecucao,
  quantidadeInicialItemExecucao,
  resolverItensExecucao,
  totalItensExecucao,
} from "@/lib/usecases/orcamento/itensExecucao";
import { reconstruirEstadoWizard } from "@/lib/usecases/orcamento/reabrirOrcamento";
import type { ConfigEmpresa, ItemExecucaoOrcamento, ItemOrcamento, Orcamento } from "@/lib/types";

const catalogo = [
  { id: "andaime", nome: "Andaime", unidade: "diária", preco: 300 },
  { id: "plataforma", nome: "Plataforma elevatória", unidade: "diária", preco: 800 },
  { id: "linha", nome: "Linha de vida", unidade: "un.", preco: 350 },
];

describe("itens de execução padrão (migração 051)", () => {
  it("catalogoItensExecucao descarta entradas sem id ou sem nome e completa a unidade", () => {
    expect(catalogoItensExecucao(null)).toEqual([]);
    expect(catalogoItensExecucao([{ id: "a", nome: " Andaime ", preco: "300" }, { id: "b", nome: "  " }, { nome: "sem id" }])).toEqual([
      { id: "a", nome: "Andaime", unidade: "un.", preco: 300 },
    ]);
  });

  it("resolverItensExecucao: só o habilitado soma; preço em branco usa o do catálogo; o resto volta como não incluído", () => {
    const itens = resolverItensExecucao(catalogo, {
      andaime: { incluido: true, quantidade: 8, precoUnitario: null },
      linha: { incluido: true, quantidade: 2, precoUnitario: 400 },
    });

    expect(itens).toEqual([
      { id: "andaime", nome: "Andaime", unidade: "diária", incluido: true, quantidade: 8, preco_unitario: 300, subtotal: 2400 },
      { id: "plataforma", nome: "Plataforma elevatória", unidade: "diária", incluido: false, quantidade: 0, preco_unitario: 800, subtotal: 0 },
      { id: "linha", nome: "Linha de vida", unidade: "un.", incluido: true, quantidade: 2, preco_unitario: 400, subtotal: 800 },
    ]);
    expect(totalItensExecucao(itens)).toBe(3200);
  });

  it("item desmarcado não soma, mesmo guardando quantidade e preço de antes", () => {
    const itens = resolverItensExecucao(catalogo, { andaime: { incluido: false, quantidade: 8, precoUnitario: 500 } });
    expect(totalItensExecucao(itens)).toBe(0);
    expect(itens[0]).toMatchObject({ incluido: false, quantidade: 0, subtotal: 0 });
  });

  it("quantidade inicial: os dias de obra quando o item é por diária, 1 nos demais", () => {
    expect(quantidadeInicialItemExecucao({ unidade: "diária" }, 12)).toBe(12);
    expect(quantidadeInicialItemExecucao({ unidade: "Diárias" }, 12)).toBe(12);
    expect(quantidadeInicialItemExecucao({ unidade: "un." }, 12)).toBe(1);
    expect(quantidadeInicialItemExecucao({ unidade: "diária" }, 0)).toBe(1);
  });
});

describe("remoção do isolamento existente — fator na mão de obra", () => {
  const p: ParametrosMaoObra = {
    eficiencia_tubulacao_pequena: 1,
    eficiencia_tubulacao_media: 1,
    eficiencia_curva: 1,
    eficiencia_altura: 0.5,
    eficiencia_fator_br: 1,
    eficiencia_remocao: 0.8,
  };
  const trecho = [{ metragemM2: 100, faixaDiametro: null, ehCurva: false }];

  it("trecho com remoção dá mais trabalho: 100 m² ÷ 0,80 = 125 m² equivalentes", () => {
    expect(calcularMaoObraPorItens(trecho, false, p, false).m2Equivalente).toBe(100);
    const com = calcularMaoObraPorItens(trecho, false, p, true);
    expect(com.m2Equivalente).toBe(125);
    expect(com.eficienciaGlobal).toBe(0.8);
  });

  it("multiplica com a altura (0,5 × 0,8 = 0,4)", () => {
    expect(calcularMaoObraPorItens(trecho, true, p, true).m2Equivalente).toBe(250);
  });

  it("sem o fator cadastrado (migração não rodada) ou zerado, a remoção não penaliza", () => {
    expect(calcularMaoObraPorItens(trecho, false, { ...p, eficiencia_remocao: undefined }, true).m2Equivalente).toBe(100);
    expect(calcularMaoObraPorItens(trecho, false, { ...p, eficiencia_remocao: 0 }, true).m2Equivalente).toBe(100);
  });
});

function item(dados: Partial<ItemOrcamento> = {}): ItemOrcamento {
  return { id: 1, ordem: 0, tipo_trabalho: "quente", material: "Lã", area_m2: 10, horas_mao_obra: 5, detalhamento_materiais: [], ...dados } as ItemOrcamento;
}
const execucao = (incluidos: string[]): ItemExecucaoOrcamento[] =>
  catalogo.map((c) => ({ id: c.id, nome: c.nome, unidade: c.unidade, incluido: incluidos.includes(c.id), quantidade: incluidos.includes(c.id) ? 2 : 0, preco_unitario: c.preco, subtotal: incluidos.includes(c.id) ? 2 * c.preco : 0 }));

describe("escopoContemplado — contempla / não contempla dinâmicos", () => {
  it("item de execução habilitado entra em 'contempla'; os demais do catálogo vão para 'Não contemplado'", () => {
    const { contempla, naoContempla } = escopoContemplado({ tipo_proposta: "material_mo", itens_execucao: execucao(["andaime"]) }, [item()]);

    expect(contempla).toContain("Andaime");
    expect(contempla).toContain("Material isolante completo");
    expect(naoContempla).toContain("Equipamentos e serviços de apoio não incluídos: Plataforma elevatória, Linha de vida");
    expect(naoContempla.join(" ")).not.toContain("Andaime");
  });

  it("sem remoção marcada, a remoção é 'Não contemplado'; com remoção, passa para 'contempla'", () => {
    const sem = escopoContemplado({ tipo_proposta: "material_mo", itens_execucao: execucao([]) }, [item()]);
    expect(sem.naoContempla).toContain("Remoção do isolamento existente");
    expect(sem.contempla.join(" ")).not.toContain("Remoção");

    const com = escopoContemplado({ tipo_proposta: "material_mo", itens_execucao: execucao([]) }, [item({ remocao_isolamento: true })]);
    expect(com.contempla).toContain("Remoção do isolamento existente");
    expect(com.naoContempla.join(" ")).not.toContain("Remoção");
  });

  it("remoção só em parte dos trechos cita quais", () => {
    const { contempla } = escopoContemplado({ tipo_proposta: "material_mo", itens_execucao: execucao([]) }, [
      item({ id: 1 }),
      item({ id: 2, remocao_isolamento: true }),
      item({ id: 3, remocao_isolamento: true }),
    ]);
    expect(contempla).toContain("Remoção do isolamento existente (trechos 2, 3)");
  });

  it("item adicional livre de um trecho também é contemplado, e tira o homônimo do catálogo do 'Não contemplado'", () => {
    const comLivre = item({
      detalhamento_materiais: [
        { chave: "item_adicional_execucao", titulo: "plataforma elevatoria", quantidade: 1, unidade: "un.", preco_unitario: 1, subtotal: 1 },
        { chave: "item_adicional_execucao", titulo: "Caçamba", quantidade: 1, unidade: "un.", preco_unitario: 1, subtotal: 1 },
      ],
    });
    const { contempla, naoContempla } = escopoContemplado({ tipo_proposta: "material_mo", itens_execucao: execucao([]) }, [comLivre]);
    expect(contempla).toEqual(expect.arrayContaining(["plataforma elevatoria", "Caçamba"]));
    expect(naoContempla).toContain("Equipamentos e serviços de apoio não incluídos: Andaime, Linha de vida");
  });

  it("tudo habilitado: a linha de não incluídos some", () => {
    const { naoContempla } = escopoContemplado({ tipo_proposta: "material_mo", itens_execucao: execucao(["andaime", "plataforma", "linha"]) }, [item()]);
    expect(naoContempla.some((t) => t.startsWith("Equipamentos e serviços"))).toBe(false);
  });

  it("'Somente Mão de Obra' continua avisando que o material é do cliente", () => {
    const { contempla, naoContempla } = escopoContemplado({ tipo_proposta: "somente_mo", itens_execucao: execucao([]) }, [item()]);
    expect(naoContempla[0]).toContain("fornecidos pelo cliente");
    expect(contempla).not.toContain("Material isolante completo");
  });

  it("orçamento anterior à migração (sem catálogo salvo) mantém o texto genérico de antes", () => {
    const { naoContempla } = escopoContemplado({ tipo_proposta: "material_mo", itens_execucao: null }, [item({ remocao_isolamento: true })]);
    expect(naoContempla).toEqual([
      "Estruturas de acesso para trabalho em altura (andaimes/plataformas), salvo se explicitamente incluídas",
      "Adequações civis/estruturais e remoção de isolamento antigo, salvo se explicitamente incluídas",
    ]);
  });
});

describe("quadro 'Itens Adicionais de Execução' com os itens padrão", () => {
  it("lista os habilitados (do orçamento inteiro) junto com os adicionais de cada trecho", () => {
    const livre = item({ detalhamento_materiais: [{ chave: "item_adicional_execucao", titulo: "Caçamba", quantidade: 1, unidade: "un.", preco_unitario: 1, subtotal: 1 }] });
    const quadros = quadrosQuantificacao({ tipo_proposta: "somente_mo", mao_obra_equipe: null, itens_execucao: execucao(["andaime"]) }, [livre]);
    const quadro = quadros.find((q) => q.titulo === "Itens Adicionais de Execução");
    expect(quadro?.linhas).toEqual([
      ["Andaime", "2 diárias"],
      ["Caçamba", "1,00 un."],
    ]);
  });

  it("com mais de um trecho, o item padrão aparece como 'Geral'", () => {
    const quadros = quadrosQuantificacao({ tipo_proposta: "somente_mo", mao_obra_equipe: null, itens_execucao: execucao(["linha"]) }, [item({ id: 1 }), item({ id: 2 })]);
    expect(quadros.find((q) => q.titulo === "Itens Adicionais de Execução")?.linhas).toEqual([["Geral", "Linha de vida", "2,00 un."]]);
  });
});

describe("reabrir orçamento com itens de execução e remoção", () => {
  it("itens incluídos voltam habilitados e a remoção do trecho volta marcada", () => {
    const orcamento = {
      id: 1,
      numero: "ORC-1",
      tipo_proposta: "material_mo",
      valor_mao_obra: 0,
      valor_desconto: 0,
      preco_cheio: 0,
      subtotal: 0,
      detalhamento_impostos: [],
      itens_execucao: execucao(["plataforma"]),
      mao_obra_equipe: { m2_equivalente: 0, producao_m2_dia: 0, horas_obra: 0, horas_uteis_dia: 7, dias: 0, dias_manual: false, pessoas: 0, funcoes: [], valor_total: 0 },
      itens: [item({ remocao_isolamento: true, escopo_itens: [], temperatura_quente: 100, temperatura_ambiente: 30 })],
    } as unknown as Orcamento;
    const { estado } = reconstruirEstadoWizard(orcamento, { horas_uteis_dia: 7, margem_lucro_padrao: 40 } as ConfigEmpresa, []);

    expect(estado.execucaoPadrao).toEqual({ plataforma: { incluido: true, quantidade: 2, precoUnitario: 800 } });
    expect(estado.itens[0].especificacoes.remocao_isolamento).toBe(true);
  });
});
