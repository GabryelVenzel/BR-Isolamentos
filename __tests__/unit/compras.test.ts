import { compararCotacao, historicoDePrecos, listaDeCompras, resumirDiarias, totalItem, totalPedido, type CompraDeItem } from "@/lib/compras";
import { alertasDocumentosDeParceiros } from "@/lib/alertas";
import type { CotacaoProposta } from "@/lib/types/domain";

describe("totais do pedido", () => {
  it("multiplica e arredonda em centavos", () => {
    expect(totalItem({ quantidade: 3, preco_unitario: 33.333 })).toBe(100);
    expect(totalPedido([{ quantidade: 2.5, preco_unitario: 58.48 }, { quantidade: 100, preco_unitario: 0.37 }])).toBe(183.2);
    expect(totalPedido([])).toBe(0);
  });
});

describe("compararCotacao", () => {
  const itens = [
    { id: "a", descricao: "Chapa alumínio", unidade: "m²", quantidade: 10 },
    { id: "b", descricao: "Rebite", unidade: "cento", quantidade: 4 },
  ];
  const proposta = (id: string, fornecedor: string, precos: Record<string, number>): CotacaoProposta => ({
    id,
    cotacao_id: "c1",
    fornecedor_id: `f-${id}`,
    precos,
    prazo_entrega_dias: null,
    condicao_pagamento: null,
    observacoes: null,
    created_at: "",
    fornecedor: { id: `f-${id}`, nome: fornecedor },
  });

  it("acha o menor preço por item e o menor total entre propostas completas", () => {
    const r = compararCotacao(itens, [
      proposta("p1", "Alfa", { a: 60, b: 20 }), // 600 + 80 = 680
      proposta("p2", "Beta", { a: 55, b: 30 }), // 550 + 120 = 670
      proposta("p3", "Gama", { a: 50 }), // incompleta: 500
    ]);
    expect(r.propostas.map((p) => [p.fornecedor, p.total, p.completa, p.itensSemPreco])).toEqual([
      ["Alfa", 680, true, 0],
      ["Beta", 670, true, 0],
      ["Gama", 500, false, 1],
    ]);
    // Gama tem o menor preço da chapa, mas não cotou tudo: não leva o menor total.
    expect(r.menorPrecoPorItem).toEqual({ a: "p3", b: "p1" });
    expect(r.melhorPropostaId).toBe("p2");
  });

  it("preço zero conta como não cotado; sem proposta completa não há vencedora", () => {
    const r = compararCotacao(itens, [proposta("p1", "Alfa", { a: 60, b: 0 })]);
    expect(r.propostas[0]).toMatchObject({ completa: false, itensSemPreco: 1, total: 600 });
    expect(r.melhorPropostaId).toBeNull();
    expect(r.menorPrecoPorItem).toEqual({ a: "p1" });
  });
});

describe("historicoDePrecos", () => {
  const compra = (c: Partial<CompraDeItem>): CompraDeItem => ({
    descricao: "Chapa Alumínio 0,5mm",
    unidade: "m²",
    preco_unitario: 50,
    quantidade: 10,
    data: "2026-09-01",
    pedido: "PC00001",
    fornecedorId: "f1",
    fornecedor: "Alfa",
    preco_config_id: null,
    ...c,
  });

  it("agrupa o mesmo item ignorando maiúsculas e espaços, e resume a evolução", () => {
    const [chapa, rebite] = historicoDePrecos([
      compra({ data: "2026-08-01", preco_unitario: 50 }),
      compra({ descricao: "  chapa alumínio  0,5mm ", data: "2026-10-01", preco_unitario: 60, fornecedor: "Beta", preco_config_id: 7 }),
      compra({ data: "2026-09-01", preco_unitario: 55 }),
      compra({ descricao: "Rebite", unidade: "cento", preco_unitario: 20, data: "2026-09-10" }),
    ]);

    expect(chapa.compras.map((c) => c.data)).toEqual(["2026-10-01", "2026-09-01", "2026-08-01"]);
    expect(chapa).toMatchObject({ ultimoPreco: 60, menorPreco: 50, maiorPreco: 60, precoMedio: 55, preco_config_id: 7 });
    expect(chapa.variacaoPercentual).toBeCloseTo(9.09, 1);
    expect(rebite).toMatchObject({ descricao: "Rebite", ultimoPreco: 20, variacaoPercentual: null });
  });

  it("mesma descrição em unidades diferentes são itens diferentes; preço zero fica de fora", () => {
    const h = historicoDePrecos([compra({ unidade: "m²" }), compra({ unidade: "kg" }), compra({ unidade: "kg", preco_unitario: 0 })]);
    expect(h).toHaveLength(2);
    expect(h.every((i) => i.compras.length === 1)).toBe(true);
  });
});

describe("listaDeCompras", () => {
  const trecho = { isolante: "Espuma Elastomérica 50kg/m³ 25mm", acabamento: "Chapa Alumínio 0,5mm", isolanteM2: 0.3, acabamentoM2: 0.4, rebiteUn: 5, parafusoUn: 5, arameMetros: 1.2, siliconeFrascos: 0 };

  it("soma trechos iguais e aplica o multiplicador, arredondando peças pra cima", () => {
    const lista = listaDeCompras([trecho, { ...trecho, acabamento: "Chapa Inox 0,5mm" }], 100);
    const por = Object.fromEntries(lista.map((i) => [i.descricao, i]));

    expect(por["Espuma Elastomérica 50kg/m³ 25mm"]).toMatchObject({ unidade: "m²", quantidade: 60 });
    expect(por["Chapa Alumínio 0,5mm"].quantidade).toBe(40);
    expect(por["Chapa Inox 0,5mm"].quantidade).toBe(40);
    expect(por["Rebite"]).toMatchObject({ unidade: "un", quantidade: 1000 });
    expect(por["Arame"]).toMatchObject({ unidade: "m", quantidade: 240 });
    expect(por["Silicone"]).toBeUndefined(); // quantidade zero não entra
  });

  it("peça fracionada depois do multiplicador sobe pro inteiro seguinte", () => {
    const lista = listaDeCompras([{ ...trecho, rebiteUn: 3, parafusoUn: 0, siliconeFrascos: 1 }], 1.5);
    const por = Object.fromEntries(lista.map((i) => [i.descricao, i.quantidade]));
    expect(por["Rebite"]).toBe(5); // 4,5 → 5
    expect(por["Silicone"]).toBe(2); // 1,5 → 2
  });
});

describe("resumirDiarias", () => {
  it("totaliza por parceiro ou funcionário, do maior valor para o menor", () => {
    const r = resumirDiarias([
      { parceiro_id: "j", pessoas: 1, valor: 270, parceiro: { id: "j", nome: "Juliar" } },
      { parceiro_id: "j", pessoas: 1, valor: 100, parceiro: { id: "j", nome: "Juliar" } },
      { parceiro_id: "w", pessoas: 2, valor: 600, parceiro: { id: "w", nome: "Wesley Henrique" } },
      // Funcionário da equipe própria: sem parceiro.
      { parceiro_id: null, funcionario_id: "f1", pessoas: 1, valor: 150, funcionario: { id: "f1", nome: "Carlos" } },
    ]);
    expect(r.total).toBe(1120);
    expect(r.pessoasDia).toBe(5);
    expect(r.porParceiro).toEqual([
      { parceiroId: "p:w", parceiro: "Wesley Henrique", proprio: false, apontamentos: 1, pessoasDia: 2, valor: 600 },
      { parceiroId: "p:j", parceiro: "Juliar", proprio: false, apontamentos: 2, pessoasDia: 2, valor: 370 },
      { parceiroId: "f:f1", parceiro: "Carlos", proprio: true, apontamentos: 1, pessoasDia: 1, valor: 150 },
    ]);
  });
});

describe("alertasDocumentosDeParceiros", () => {
  it("separa vencidos e vencendo, no módulo Operacional", () => {
    const alertas = alertasDocumentosDeParceiros(
      [
        { parceiro: "Juliar", nome: "ASO.pdf", validade: "2026-10-01" },
        { parceiro: "Wesley Henrique", nome: "NR35.pdf", validade: "2026-10-20" },
        { parceiro: "Rodrigo", nome: "Apólice.pdf", validade: "2027-06-01" },
      ],
      "2026-10-09",
      30
    );
    expect(alertas.map((a) => [a.id, a.modulo, a.severidade, a.detalhe])).toEqual([
      ["documentos-parceiro-vencidos", "operacional", "critico", "ASO.pdf (Juliar)."],
      ["documentos-parceiro-vencendo", "operacional", "atencao", "NR35.pdf (Wesley Henrique)."],
    ]);
  });
});
