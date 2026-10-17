import {
  calcularMaoObraEquipe,
  diasFechados,
  distribuirMaoObraPorTrecho,
  linhasDaEquipeAntiga,
  type EquipeMaoObra,
  type ParametrosEquipe,
} from "@/lib/usecases/orcamento/maoObraEquipe";

// Equipe por função em linhas MEI (custo = diária combinada, sem encargos) —
// os cenários abaixo testam dias e diárias; os encargos têm testes próprios.
const eq = (equipe: EquipeMaoObra, valores?: Parameters<typeof linhasDaEquipeAntiga>[1]) => linhasDaEquipeAntiga(equipe, valores, "mei");

// Dia de 7 h úteis; cada função com o seu rendimento (m² por pessoa por dia)
// e a sua diária.
const parametros: ParametrosEquipe = {
  valor_diaria_funileiro: 400,
  valor_diaria_isolador: 350,
  valor_diaria_ajudante: 200,
  m2_dia_funileiro: 7,
  m2_dia_isolador: 7,
  m2_dia_ajudante: 3.5,
  horas_uteis_dia: 7,
};

describe("diasFechados", () => {
  it("exemplo do pedido: 82 h em dias de 7 h = 11,7 → 12 diárias", () => {
    expect(diasFechados(82, 7)).toBe(12);
  });

  it("dia exato não ganha um dia a mais (84 h ÷ 7 h = 12)", () => {
    expect(diasFechados(84, 7)).toBe(12);
  });

  it("qualquer fração de dia vira um dia inteiro", () => {
    expect(diasFechados(0.5, 7)).toBe(1);
    expect(diasFechados(7.01, 7)).toBe(2);
  });

  it("sem horas ou sem jornada, zero dias", () => {
    expect(diasFechados(0, 7)).toBe(0);
    expect(diasFechados(10, 0)).toBe(0);
  });
});

describe("calcularMaoObraEquipe", () => {
  it("1 funileiro + 1 isolador: produção de 14 m²/dia; 164 m² equivalentes = 82 h → 12 dias, 12 diárias de cada", () => {
    const r = calcularMaoObraEquipe({ m2Equivalente: 164, linhas: eq({ funileiro: 1, isolador: 1, ajudante: 0 }), parametros });

    expect(r.producao_m2_dia).toBe(14);
    expect(r.horas_obra).toBe(82); // 164 ÷ (14 m²/dia ÷ 7 h)
    expect(r.dias).toBe(12);
    expect(r.dias_manual).toBe(false);
    expect(r.pessoas).toBe(2);
    expect(r.funcoes).toMatchObject([
      { funcao: "funileiro", pessoas: 1, m2_dia: 7, valor_diaria: 400, diarias: 12, subtotal: 4800 },
      { funcao: "isolador", pessoas: 1, m2_dia: 7, valor_diaria: 350, diarias: 12, subtotal: 4200 },
    ]);
    expect(r.valor_total).toBe(9000);
  });

  it("cada função soma o próprio rendimento: 2 isoladores + 1 ajudante = 17,5 m²/dia", () => {
    const r = calcularMaoObraEquipe({ m2Equivalente: 175, linhas: eq({ funileiro: 0, isolador: 2, ajudante: 1 }), parametros });

    expect(r.producao_m2_dia).toBe(17.5);
    expect(r.horas_obra).toBe(70);
    expect(r.dias).toBe(10);
    // 2 × 10 × 350 + 1 × 10 × 200
    expect(r.valor_total).toBe(9000);
    expect(r.funcoes.map((f) => f.funcao)).toEqual(["isolador", "ajudante"]);
  });

  it("mais gente na equipe reduz os dias, e todos são cobrados pelos mesmos dias fechados", () => {
    const dupla = calcularMaoObraEquipe({ m2Equivalente: 100, linhas: eq({ funileiro: 1, isolador: 1 }), parametros });
    const quatro = calcularMaoObraEquipe({ m2Equivalente: 100, linhas: eq({ funileiro: 2, isolador: 2 }), parametros });

    expect(dupla.dias).toBe(8); // 100 ÷ 14 = 7,14
    expect(quatro.dias).toBe(4); // 100 ÷ 28 = 3,57
    expect(quatro.funcoes.every((f) => f.diarias === 4)).toBe(true);
  });

  it("menos horas úteis no local = mais dias (e mais diárias)", () => {
    const padrao = calcularMaoObraEquipe({ m2Equivalente: 140, linhas: eq({ funileiro: 1, isolador: 1 }), parametros });
    const local = calcularMaoObraEquipe({ m2Equivalente: 140, linhas: eq({ funileiro: 1, isolador: 1 }), parametros, horasUteisDia: 5 });

    expect(padrao.horas_obra).toBe(70);
    expect(padrao.dias).toBe(10);
    expect(local.horas_obra).toBe(70); // o trabalho é o mesmo
    expect(local.dias).toBe(14); // 70 h ÷ 5 h
    expect(local.valor_total).toBeGreaterThan(padrao.valor_total);
  });

  it("valor de diária ajustado só neste orçamento substitui o da configuração", () => {
    const r = calcularMaoObraEquipe({
      m2Equivalente: 14,
      linhas: eq({ funileiro: 1, isolador: 1 }, { funileiro: 500, isolador: null }),
      parametros,
    });
    expect(r.dias).toBe(1);
    expect(r.funcoes.find((f) => f.funcao === "funileiro")?.valor_diaria).toBe(500);
    expect(r.funcoes.find((f) => f.funcao === "isolador")?.valor_diaria).toBe(350);
    expect(r.valor_total).toBe(850);
  });

  it("dias digitados à mão prevalecem sobre o cálculo", () => {
    const r = calcularMaoObraEquipe({ m2Equivalente: 164, linhas: eq({ funileiro: 1, isolador: 1 }), parametros, diasManual: 15 });
    expect(r.dias).toBe(15);
    expect(r.dias_manual).toBe(true);
    expect(r.valor_total).toBe(15 * 750);
  });

  it("TST (migração 050): cobrado pelos mesmos dias da equipe, mas não produz nem reduz os dias", () => {
    const comTst = { ...parametros, valor_diaria_tst: 450 };
    const semTst = calcularMaoObraEquipe({ m2Equivalente: 164, linhas: eq({ funileiro: 1, isolador: 1 }), parametros: comTst });
    const r = calcularMaoObraEquipe({ m2Equivalente: 164, linhas: eq({ funileiro: 1, isolador: 1, tst: 1 }), parametros: comTst });

    // produção, horas e dias iguais aos da equipe sem o TST
    expect(r.producao_m2_dia).toBe(semTst.producao_m2_dia);
    expect(r.horas_obra).toBe(82);
    expect(r.dias).toBe(12);
    expect(r.pessoas).toBe(3);
    expect(r.funcoes.find((f) => f.funcao === "tst")).toMatchObject({ funcao: "tst", pessoas: 1, m2_dia: 0, valor_diaria: 450, diarias: 12, subtotal: 5400 });
    expect(r.valor_total).toBe(semTst.valor_total + 5400);
  });

  it("equipe só com TST não tem quem produza: sem dias calculados (só com dias à mão)", () => {
    const comTst = { ...parametros, valor_diaria_tst: 450 };
    expect(calcularMaoObraEquipe({ m2Equivalente: 100, linhas: eq({ tst: 1 }), parametros: comTst })).toMatchObject({ pessoas: 1, producao_m2_dia: 0, dias: 0, valor_total: 0 });
    expect(calcularMaoObraEquipe({ m2Equivalente: 100, linhas: eq({ tst: 1 }), parametros: comTst, diasManual: 3 }).valor_total).toBe(1350);
  });

  it("diária do TST ainda não cadastrada (migração 050 não rodada) vale zero, sem quebrar", () => {
    const r = calcularMaoObraEquipe({ m2Equivalente: 14, linhas: eq({ funileiro: 1, isolador: 1, tst: 1 }), parametros });
    expect(r.funcoes.find((f) => f.funcao === "tst")?.subtotal).toBe(0);
    expect(r.valor_total).toBe(750);
  });

  it("sem equipe (ou com rendimento zerado) não há horas, dias nem valor — e nada quebra", () => {
    const semEquipe = calcularMaoObraEquipe({ m2Equivalente: 100, linhas: eq({ funileiro: 0, isolador: 0, ajudante: 0 }), parametros });
    expect(semEquipe).toMatchObject({ pessoas: 0, producao_m2_dia: 0, horas_obra: 0, dias: 0, valor_total: 0, funcoes: [] });

    const semRendimento = calcularMaoObraEquipe({
      m2Equivalente: 100,
      linhas: eq({ ajudante: 2 }),
      parametros: { ...parametros, m2_dia_ajudante: 0 },
    });
    expect(semRendimento.pessoas).toBe(2);
    expect(semRendimento.dias).toBe(0);
    expect(semRendimento.valor_total).toBe(0);
  });
});

describe("distribuirMaoObraPorTrecho", () => {
  it("reparte horas e valor proporcional ao trabalho de cada trecho, e a soma bate com o total", () => {
    const partes = distribuirMaoObraPorTrecho([100, 50, 14], { horas_obra: 82, valor_total: 9000 });

    expect(partes).toHaveLength(3);
    expect(Number(partes.reduce((acc, p) => acc + p.horas, 0).toFixed(2))).toBe(82);
    expect(Number(partes.reduce((acc, p) => acc + p.valor, 0).toFixed(2))).toBe(9000);
    expect(partes[0].valor).toBeGreaterThan(partes[1].valor);
    expect(partes[1].valor).toBeGreaterThan(partes[2].valor);
  });

  it("trecho com a mão de obra excluída (trabalho 0) não recebe nada", () => {
    const partes = distribuirMaoObraPorTrecho([0, 80], { horas_obra: 40, valor_total: 3000 });
    expect(partes).toEqual([
      { horas: 0, valor: 0 },
      { horas: 40, valor: 3000 },
    ]);
  });

  it("sem trabalho em nenhum trecho (dias digitados à mão), divide em partes iguais", () => {
    const partes = distribuirMaoObraPorTrecho([0, 0], { horas_obra: 0, valor_total: 1000 });
    expect(partes.map((p) => p.valor)).toEqual([500, 500]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(distribuirMaoObraPorTrecho([], { horas_obra: 10, valor_total: 100 })).toEqual([]);
  });
});

describe("equipe por linhas com encargos (migração 056)", () => {
  const cfg = { ...parametros, valor_diaria_funileiro: 550, valor_diaria_isolador: 550, regime_tributario: "simples_nacional" as const, simples_nacional_anexo: "III" as const };

  it("mesma função com formas diferentes: 1 funileiro MEI + 1 funileiro PF, 5 dias", () => {
    const r = calcularMaoObraEquipe({
      m2Equivalente: 70, // 70 ÷ 14 m²/dia = 5 dias
      linhas: [
        { id: "a", funcao: "funileiro", forma: "mei", pessoas: 1, valor_diaria: null },
        { id: "b", funcao: "funileiro", forma: "pf", pessoas: 1, valor_diaria: null },
      ],
      parametros: cfg,
    });
    expect(r.dias).toBe(5);
    expect(r.funcoes.find((f) => f.id === "a")).toMatchObject({ forma: "mei", valor_pago: 2750, encargos: 0, subtotal: 2750 });
    expect(r.funcoes.find((f) => f.id === "b")).toMatchObject({ forma: "pf", valor_pago: 2750, bruto: 3089.89, inss: 339.89, irrf: 0, cpp: 0, encargos: 339.89, subtotal: 3089.89 });
    expect(r.valor_pago_pessoas).toBe(5500);
    expect(r.encargos_total).toBe(339.89);
    expect(r.valor_total).toBe(5839.89);
  });

  it("encargos por pessoa: 2 pessoas físicas na mesma linha = 2 × o custo de uma", () => {
    const um = calcularMaoObraEquipe({ m2Equivalente: 70, linhas: [{ id: "a", funcao: "funileiro", forma: "pf", pessoas: 1, valor_diaria: null }], parametros: cfg, diasManual: 20 });
    const dois = calcularMaoObraEquipe({ m2Equivalente: 70, linhas: [{ id: "a", funcao: "funileiro", forma: "pf", pessoas: 2, valor_diaria: null }], parametros: cfg, diasManual: 20 });
    expect(um.valor_total).toBe(14851.3);
    expect(dois.valor_total).toBe(29702.6);
  });

  it("forma em branco usa a forma padrão da configuração (sem configuração: pessoa física)", () => {
    const linhas = [{ id: "a", funcao: "isolador" as const, forma: null, pessoas: 1, valor_diaria: null }];
    expect(calcularMaoObraEquipe({ m2Equivalente: 70, linhas, parametros: cfg }).funcoes[0].forma).toBe("pf");
    const comMei = { ...cfg, forma_contratacao_padrao: { isolador: "mei" } };
    expect(calcularMaoObraEquipe({ m2Equivalente: 70, linhas, parametros: comMei }).funcoes[0].forma).toBe("mei");
  });

  it("Supervisor produz: soma o rendimento dele na equipe", () => {
    const comSup = { ...cfg, valor_diaria_supervisor: 700, m2_dia_supervisor: 7 };
    const r = calcularMaoObraEquipe({
      m2Equivalente: 105,
      linhas: [
        { id: "a", funcao: "funileiro", forma: "mei", pessoas: 1, valor_diaria: null },
        { id: "s", funcao: "supervisor", forma: "mei", pessoas: 1, valor_diaria: null },
      ],
      parametros: comSup,
    });
    expect(r.producao_m2_dia).toBe(14);
    expect(r.dias).toBe(8); // 105 ÷ 14 = 7,5
    expect(r.funcoes.find((f) => f.funcao === "supervisor")).toMatchObject({ m2_dia: 7, valor_diaria: 700, subtotal: 5600 });
  });

  it("orçamento antigo (forma não informada): mesmo valor de antes, sem encargos", () => {
    const r = calcularMaoObraEquipe({ m2Equivalente: 164, linhas: linhasDaEquipeAntiga({ funileiro: 1, isolador: 1 }, { funileiro: 400 }), parametros: cfg });
    expect(r.encargos_total).toBe(0);
    expect(r.valor_total).toBe(12 * 400 + 12 * 550);
  });

  it("Anexo IV: pessoa física paga 20% patronal sobre o bruto", () => {
    const anexoIV = { ...cfg, simples_nacional_anexo: "IV" as const };
    const r = calcularMaoObraEquipe({ m2Equivalente: 70, linhas: [{ id: "a", funcao: "funileiro", forma: "pf", pessoas: 1, valor_diaria: null }], parametros: anexoIV, diasManual: 20 });
    expect(r.valor_total).toBe(17821.56);
  });
});
