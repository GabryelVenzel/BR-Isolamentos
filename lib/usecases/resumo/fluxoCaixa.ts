// Fluxo de caixa (regime de CAIXA — quando o dinheiro entra/sai), base do
// Resumo. Função pura: recebe os lançamentos, os custos fixos e o ponto de
// partida do caixa (migração 053) e devolve saldo de hoje, projeção diária,
// visão por mês e por semana, e o "aging" do que está em aberto.
//
// Regras (decididas com o usuário):
//   - Saldo de hoje = saldo inicial (config_empresa.caixa_saldo_inicial, em
//     caixa_data_inicial) + tudo PAGO/RECEBIDO desde essa data, pela data do
//     pagamento (data_pagamento; sem ela, a data do lançamento).
//   - Projeção CONSERVADORA: contas a PAGAR vencidas saem do caixa já (hoje);
//     contas a RECEBER vencidas NÃO entram — ficam destacadas como risco.
//   - Lançamentos em aberto entram no dia do vencimento (`data`).
//   - Custos fixos ativos: o lançamento do mês corrente já existe (sweep de
//     garantirHistoricoMesAtual); para os meses seguintes, que ainda não têm
//     lançamento, o custo entra no dia_mes de cada mês. Custo sem dia_mes é
//     espalhado por igual (1/30 por dia), como antes.

import type { CustoFixo, LancamentoFinanceiro } from "../../types/domain";

export interface PontoFluxoDiario {
  data: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface MesFluxo {
  /** "YYYY-MM" */
  mes: string;
  entradasRealizadas: number;
  saidasRealizadas: number;
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoFinal: number;
  situacao: "passado" | "atual" | "futuro";
}

export interface SemanaFluxo {
  inicio: string;
  fim: string;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
}

export interface FaixaAging {
  label: string;
  aReceber: number;
  aPagar: number;
}

export interface FluxoCaixa {
  dataInicial: string;
  saldoInicial: number;
  hoje: string;
  saldoHoje: number;
  aReceberVencido: { valor: number; quantidade: number };
  aPagarVencido: { valor: number; quantidade: number };
  /** Hoje (já sem os vencidos a pagar) + os próximos `diasProjecao` dias. */
  diario: PontoFluxoDiario[];
  menorSaldo: { valor: number; data: string };
  saldoEm: { d30: number; d60: number; d90: number };
  primeiroDiaNegativo: string | null;
  meses: MesFluxo[];
  semanas: SemanaFluxo[];
  aging: FaixaAging[];
}

export interface EntradaFluxoCaixa {
  lancamentos: Array<Pick<LancamentoFinanceiro, "tipo" | "valor" | "data" | "pago" | "data_pagamento" | "descricao" | "categoria">>;
  custosFixos: Array<Pick<CustoFixo, "ativo" | "valor_mensal" | "dia_mes" | "descricao" | "categoria">>;
  saldoInicial: number;
  dataInicial: string;
  hoje: string;
  diasProjecao?: number;
  mesesHistorico?: number;
  semanas?: number;
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function somarMesesAoMes(mes: string, n: number): string {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function ultimoDiaDoMes(mes: string): number {
  return new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
}

function diferencaDias(de: string, ate: string): number {
  return Math.round((new Date(`${ate}T00:00:00Z`).getTime() - new Date(`${de}T00:00:00Z`).getTime()) / 86400000);
}

const sinal = (tipo: string) => (tipo === "receita" ? 1 : -1);

export function calcularFluxoCaixa(entrada: EntradaFluxoCaixa): FluxoCaixa {
  const { lancamentos, custosFixos, saldoInicial, dataInicial, hoje } = entrada;
  const diasProjecao = entrada.diasProjecao ?? 90;
  const mesesHistorico = entrada.mesesHistorico ?? 6;
  const qtdSemanas = entrada.semanas ?? 8;
  const fimProjecao = somarDias(hoje, diasProjecao);
  const mesAtual = hoje.slice(0, 7);

  // --- Realizado (pagos desde a data inicial do caixa) ---
  const pagos = lancamentos
    .filter((l) => l.pago)
    .map((l) => ({ tipo: l.tipo, valor: Number(l.valor), data: l.data_pagamento ?? l.data }))
    .filter((l) => l.data >= dataInicial && l.data <= hoje);
  const saldoHoje = saldoInicial + pagos.reduce((s, l) => s + sinal(l.tipo) * l.valor, 0);

  // --- Em aberto ---
  const abertos = lancamentos.filter((l) => !l.pago).map((l) => ({ ...l, valor: Number(l.valor) }));
  const vencidosReceber = abertos.filter((l) => l.tipo === "receita" && l.data < hoje);
  const vencidosPagar = abertos.filter((l) => l.tipo === "despesa" && l.data < hoje);

  // Movimentos previstos por dia (de hoje em diante).
  const previstos: Array<{ tipo: string; valor: number; data: string }> = abertos
    .filter((l) => l.data >= hoje && l.data <= fimProjecao)
    .map((l) => ({ tipo: l.tipo, valor: l.valor, data: l.data }));

  // Custos fixos com dia_mes nos meses seguintes (o mês atual já tem lançamento).
  // Se, por algum motivo, o mês atual ainda não tiver o lançamento, o custo
  // também entra (comparando descrição e categoria).
  for (const custo of custosFixos) {
    if (!custo.ativo || custo.dia_mes == null) continue;
    for (let i = 0; i <= Math.ceil(diasProjecao / 28); i++) {
      const mes = somarMesesAoMes(mesAtual, i);
      const dia = Math.min(custo.dia_mes, ultimoDiaDoMes(mes));
      const data = `${mes}-${String(dia).padStart(2, "0")}`;
      if (data < hoje || data > fimProjecao) continue;
      const jaLancado = lancamentos.some(
        (l) => l.tipo === "despesa" && l.data.slice(0, 7) === mes && l.descricao === custo.descricao && l.categoria === custo.categoria
      );
      if (!jaLancado) previstos.push({ tipo: "despesa", valor: Number(custo.valor_mensal), data });
    }
  }
  const custoFixoDiario = custosFixos.filter((c) => c.ativo && c.dia_mes == null).reduce((s, c) => s + Number(c.valor_mensal), 0) / 30;

  // --- Projeção diária ---
  const valorPagarVencido = vencidosPagar.reduce((s, l) => s + l.valor, 0);
  const diario: PontoFluxoDiario[] = [];
  let saldo = saldoHoje;
  for (let i = 0; i <= diasProjecao; i++) {
    const data = somarDias(hoje, i);
    const doDia = previstos.filter((p) => p.data === data);
    let entradas = doDia.filter((p) => p.tipo === "receita").reduce((s, p) => s + p.valor, 0);
    let saidas = doDia.filter((p) => p.tipo === "despesa").reduce((s, p) => s + p.valor, 0) + (i > 0 ? custoFixoDiario : 0);
    if (i === 0) saidas += valorPagarVencido;
    entradas = Math.round(entradas * 100) / 100;
    saidas = Math.round(saidas * 100) / 100;
    saldo += entradas - saidas;
    diario.push({ data, entradas, saidas, saldo: Math.round(saldo * 100) / 100 });
  }
  const menor = diario.reduce((m, p) => (p.saldo < m.saldo ? p : m), diario[0]);
  const saldoNoDia = (n: number) => diario[Math.min(n, diario.length - 1)].saldo;

  // --- Por mês: histórico realizado + atual (realizado + previsto) + futuros previstos ---
  const primeiroMes = [dataInicial.slice(0, 7), somarMesesAoMes(mesAtual, -(mesesHistorico - 1))].sort().reverse()[0];
  const ultimoMes = fimProjecao.slice(0, 7);
  const meses: MesFluxo[] = [];
  let acumulado = saldoInicial;
  for (let mes = primeiroMes; mes <= ultimoMes; mes = somarMesesAoMes(mes, 1)) {
    const realizadosMes = pagos.filter((l) => l.data.slice(0, 7) === mes);
    const entradasRealizadas = realizadosMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
    const saidasRealizadas = realizadosMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
    const diasMes = diario.filter((p) => p.data.slice(0, 7) === mes);
    const entradasPrevistas = diasMes.reduce((s, p) => s + p.entradas, 0);
    const saidasPrevistas = diasMes.reduce((s, p) => s + p.saidas, 0);
    acumulado += entradasRealizadas - saidasRealizadas + entradasPrevistas - saidasPrevistas;
    meses.push({
      mes,
      entradasRealizadas,
      saidasRealizadas,
      entradasPrevistas,
      saidasPrevistas,
      saldoFinal: Math.round(acumulado * 100) / 100,
      situacao: mes < mesAtual ? "passado" : mes === mesAtual ? "atual" : "futuro",
    });
  }
  // Pagos antes do primeiro mês mostrado (histórico longo) entram no ponto de partida.
  const anteriores = pagos.filter((l) => l.data.slice(0, 7) < primeiroMes).reduce((s, l) => s + sinal(l.tipo) * l.valor, 0);
  if (anteriores !== 0) for (const m of meses) m.saldoFinal = Math.round((m.saldoFinal + anteriores) * 100) / 100;

  // --- Próximas semanas (segunda a domingo, a partir da semana de hoje) ---
  const segunda = somarDias(hoje, -((new Date(`${hoje}T00:00:00Z`).getUTCDay() + 6) % 7));
  const semanas: SemanaFluxo[] = [];
  for (let i = 0; i < qtdSemanas; i++) {
    const inicio = somarDias(segunda, i * 7);
    const fim = somarDias(inicio, 6);
    const dias = diario.filter((p) => p.data >= inicio && p.data <= fim);
    if (dias.length === 0) break;
    const saldoFinal = dias[dias.length - 1].saldo;
    const entradas = dias.reduce((s, p) => s + p.entradas, 0);
    const saidas = dias.reduce((s, p) => s + p.saidas, 0);
    semanas.push({ inicio, fim, saldoInicial: Math.round((saldoFinal - entradas + saidas) * 100) / 100, entradas, saidas, saldoFinal });
  }

  // --- Aging do que está em aberto ---
  const faixas: Array<{ label: string; teste: (dias: number) => boolean }> = [
    { label: "Vencido há mais de 30 dias", teste: (d) => d < -30 },
    { label: "Vencido até 30 dias", teste: (d) => d < 0 && d >= -30 },
    { label: "Vence em até 30 dias", teste: (d) => d >= 0 && d <= 30 },
    { label: "Vence em 31 a 60 dias", teste: (d) => d > 30 && d <= 60 },
    { label: "Vence em mais de 60 dias", teste: (d) => d > 60 },
  ];
  const aging = faixas.map((f) => {
    const daFaixa = abertos.filter((l) => f.teste(diferencaDias(hoje, l.data)));
    return {
      label: f.label,
      aReceber: daFaixa.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0),
      aPagar: daFaixa.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0),
    };
  });

  return {
    dataInicial,
    saldoInicial,
    hoje,
    saldoHoje: Math.round(saldoHoje * 100) / 100,
    aReceberVencido: { valor: vencidosReceber.reduce((s, l) => s + l.valor, 0), quantidade: vencidosReceber.length },
    aPagarVencido: { valor: valorPagarVencido, quantidade: vencidosPagar.length },
    diario,
    menorSaldo: { valor: menor.saldo, data: menor.data },
    saldoEm: { d30: saldoNoDia(30), d60: saldoNoDia(60), d90: saldoNoDia(90) },
    primeiroDiaNegativo: diario.find((p) => p.saldo < 0)?.data ?? null,
    meses,
    semanas,
    aging,
  };
}
