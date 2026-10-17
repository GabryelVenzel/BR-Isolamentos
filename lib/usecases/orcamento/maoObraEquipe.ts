// Mão de obra por EQUIPE e DIÁRIAS (migração 048) — puro, sem I/O.
//
// Substitui o modelo "horas de uma dupla × valor/hora". Agora:
//
//   - a equipe da proposta é escolhida por função: quantos funileiros,
//     isoladores e ajudantes — e, se a obra pedir, Técnico de Segurança do
//     Trabalho (TST), que é cobrado pelos mesmos dias mas não produz;
//   - cada função tem o seu rendimento (m² por pessoa por dia) e o seu valor
//     de diária, configurados em Configurar Preços;
//   - o trabalho de cada trecho continua saindo dos mesmos fatores de
//     eficiência de sempre (diâmetro × curva × altura × fator BR — ver
//     calcularMaoObraAutomatica.ts), só que expresso em "m² equivalentes"
//     (metragem ÷ eficiência), que não dependem de quem vai executar;
//   - as horas servem de base de cálculo, e a proposta cobra sempre DIAS
//     FECHADOS, iguais para toda a equipe:
//
//       produção da equipe (m²/dia) = Σ pessoas × rendimento da função
//       horas de obra  = m² equivalentes ÷ (produção ÷ horas do dia padrão)
//       dias           = horas de obra ÷ horas úteis do dia, SEMPRE para cima
//       valor          = dias × Σ (pessoas × diária da função)
//
//     Ex.: 82 h de obra em dias de 7 h úteis = 11,7 → 12 diárias de cada
//     pessoa da equipe.
//
// O cálculo é feito uma vez para a PROPOSTA inteira (os m² equivalentes de
// todos os trechos somados) — arredondar trecho a trecho cobraria um dia a
// mais por trecho. `distribuirMaoObraPorTrecho` só reparte o resultado entre
// os trechos, para exibição e para o rateio do valor final.

import type { ConfigEmpresa, FormaContratacao, FuncaoMaoObra, LinhaEquipeMaoObra, MaoObraEquipe } from "../../types";
import { encargosDaPessoa, parametrosEncargosDaConfig } from "./encargosMaoObra";

export const FUNCOES_MAO_OBRA: readonly FuncaoMaoObra[] = ["funileiro", "isolador", "ajudante", "supervisor", "tst"];

export const LABEL_FUNCAO_MAO_OBRA: Record<FuncaoMaoObra, string> = {
  funileiro: "Funileiro",
  isolador: "Isolador",
  ajudante: "Ajudante",
  supervisor: "Supervisor",
  tst: "Técnico de Segurança do Trabalho",
};

/** Cargos que não executam o isolamento (migração 050): acompanham a obra
 * pelos mesmos dias e são cobrados por diária, mas não têm rendimento — não
 * somam na produção da equipe nem reduzem os dias. */
export const FUNCOES_SEM_RENDIMENTO: readonly FuncaoMaoObra[] = ["tst"];
// O Supervisor (migração 056) produz: tem rendimento próprio em m²/dia.

export function funcaoProduz(funcao: FuncaoMaoObra): boolean {
  return !FUNCOES_SEM_RENDIMENTO.includes(funcao);
}

/** Quantas pessoas de cada função — formato ANTERIOR à migração 056 (só
 * para ler estados antigos; ver `linhasDaEquipeAntiga`). */
export type EquipeMaoObra = Partial<Record<FuncaoMaoObra, number>>;

/** Equipe inicial de um orçamento novo: 1 funileiro + 1 isolador, na forma e
 * na diária padrão da configuração. */
export const EQUIPE_LINHAS_PADRAO: LinhaEquipeMaoObra[] = [
  { id: "funileiro-1", funcao: "funileiro", forma: null, pessoas: 1, valor_diaria: null },
  { id: "isolador-1", funcao: "isolador", forma: null, pessoas: 1, valor_diaria: null },
];

/** Converte a equipe antiga (pessoas por função + diária ajustada) em linhas.
 * A forma fica "não informada" (sem encargos) para o valor de um orçamento
 * antigo não mudar só por ser reaberto. */
export function linhasDaEquipeAntiga(
  equipe: EquipeMaoObra | undefined | null,
  valoresDiaria: Partial<Record<FuncaoMaoObra, number | null>> | undefined | null,
  forma: FormaContratacao | null = "nao_informada"
): LinhaEquipeMaoObra[] {
  return FUNCOES_MAO_OBRA.filter((f) => Math.floor(Number(equipe?.[f]) || 0) > 0).map((funcao) => ({
    id: `${funcao}-1`,
    funcao,
    forma,
    pessoas: Math.floor(Number(equipe?.[funcao]) || 0),
    valor_diaria: valoresDiaria?.[funcao] ?? null,
  }));
}

/** Forma de contratação padrão de cada função (Configurações do orçamento);
 * sem configuração: pessoa física (o cenário mais caro). */
export function formaPadrao(funcao: FuncaoMaoObra, config: Pick<ConfigEmpresa, "forma_contratacao_padrao"> | Partial<ConfigEmpresa>): FormaContratacao {
  const mapa = (config as Partial<ConfigEmpresa>).forma_contratacao_padrao as Partial<Record<FuncaoMaoObra, FormaContratacao>> | null | undefined;
  return mapa?.[funcao] ?? "pf";
}

export type ParametrosEquipe = Pick<
  ConfigEmpresa,
  | "valor_diaria_funileiro"
  | "valor_diaria_isolador"
  | "valor_diaria_ajudante"
  | "valor_diaria_tst"
  | "m2_dia_funileiro"
  | "m2_dia_isolador"
  | "m2_dia_ajudante"
  | "horas_uteis_dia"
> &
  Partial<ConfigEmpresa>;

export function valorDiariaPadrao(funcao: FuncaoMaoObra, parametros: ParametrosEquipe): number {
  return Number(parametros[`valor_diaria_${funcao}` as keyof ParametrosEquipe]) || 0;
}

export function rendimentoM2Dia(funcao: FuncaoMaoObra, parametros: ParametrosEquipe): number {
  if (!funcaoProduz(funcao)) return 0;
  return Number(parametros[`m2_dia_${funcao}` as keyof ParametrosEquipe]) || 0;
}

const round2 = (n: number) => Number(n.toFixed(2));
const inteiroNaoNegativo = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));

/** Horas → dias fechados, sempre para cima. O arredondamento intermediário
 * evita que um resíduo de ponto flutuante (84 ÷ 7 = 12,000000001) vire um
 * dia a mais. */
export function diasFechados(horasObra: number, horasUteisDia: number): number {
  if (!(horasObra > 0) || !(horasUteisDia > 0)) return 0;
  return Math.ceil(Number((horasObra / horasUteisDia).toFixed(6)));
}

export function calcularMaoObraEquipe(input: {
  /** Soma dos m² equivalentes (metragem ÷ eficiência) de todos os trechos. */
  m2Equivalente: number;
  /** Linhas da equipe (migração 056). */
  linhas: LinhaEquipeMaoObra[];
  /** Configuração: diárias, rendimentos, forma padrão, horas do dia e os
   * parâmetros de encargos (regime/anexo, INSS, IR...). */
  parametros: ParametrosEquipe;
  /** Horas úteis por dia desta proposta; `null` = o padrão da configuração.
   * Menos horas produtivas no local = mais dias (e mais diárias). */
  horasUteisDia?: number | null;
  /** Quantidade de dias digitada à mão; `null` = automática. */
  diasManual?: number | null;
}): MaoObraEquipe {
  const horasDiaPadrao = Number(input.parametros.horas_uteis_dia) || 0;
  const horasUteisDia = input.horasUteisDia && input.horasUteisDia > 0 ? input.horasUteisDia : horasDiaPadrao;
  const m2Equivalente = Math.max(0, Number(input.m2Equivalente) || 0);
  const encargos = parametrosEncargosDaConfig(input.parametros);

  const composicao = input.linhas
    .filter((l) => FUNCOES_MAO_OBRA.includes(l.funcao))
    .map((l) => ({
      id: l.id,
      funcao: l.funcao,
      forma: l.forma ?? formaPadrao(l.funcao, input.parametros),
      pessoas: inteiroNaoNegativo(l.pessoas),
      m2_dia: rendimentoM2Dia(l.funcao, input.parametros),
      valor_diaria: Math.max(0, l.valor_diaria ?? valorDiariaPadrao(l.funcao, input.parametros)),
    }));

  const producaoM2Dia = composicao.reduce((acc, f) => acc + f.pessoas * f.m2_dia, 0);
  // O rendimento é "por dia padrão" — por hora, a equipe produz produção ÷
  // horas do dia padrão.
  const horasObra = producaoM2Dia > 0 && horasDiaPadrao > 0 ? round2(m2Equivalente / (producaoM2Dia / horasDiaPadrao)) : 0;

  const manual = input.diasManual != null && input.diasManual >= 0;
  const dias = manual ? inteiroNaoNegativo(input.diasManual) : diasFechados(horasObra, horasUteisDia);

  // Encargos por PESSOA (INSS e IR são mensais e individuais) × pessoas da linha.
  const funcoes = composicao
    .filter((f) => f.pessoas > 0)
    .map((f) => {
      const e = encargosDaPessoa(f.forma, f.valor_diaria, dias, encargos);
      const vezes = (n: number) => round2(n * f.pessoas);
      const valorPago = vezes(e.valor_pago);
      const subtotal = vezes(e.custo_real);
      return {
        ...f,
        diarias: dias,
        valor_pago: valorPago,
        bruto: vezes(e.bruto),
        inss: vezes(e.inss),
        irrf: vezes(e.irrf),
        iss: vezes(e.iss),
        cpp: vezes(e.cpp),
        encargos: round2(subtotal - valorPago),
        subtotal,
      };
    });

  const valorTotal = round2(funcoes.reduce((acc, f) => acc + f.subtotal, 0));
  const valorPago = round2(funcoes.reduce((acc, f) => acc + f.valor_pago, 0));
  return {
    m2_equivalente: round2(m2Equivalente),
    producao_m2_dia: round2(producaoM2Dia),
    horas_obra: horasObra,
    horas_uteis_dia: horasUteisDia,
    dias,
    dias_manual: manual,
    pessoas: funcoes.reduce((acc, f) => acc + f.pessoas, 0),
    funcoes,
    valor_total: valorTotal,
    valor_pago_pessoas: valorPago,
    encargos_total: round2(valorTotal - valorPago),
  };
}

/** Reparte horas e valor da mão de obra da proposta entre os trechos,
 * proporcional aos m² equivalentes de cada um (em partes iguais, se nenhum
 * tiver metragem). O último trecho absorve o arredondamento, para a soma
 * bater exatamente com o total. */
export function distribuirMaoObraPorTrecho(m2EquivalentePorTrecho: number[], maoObra: Pick<MaoObraEquipe, "horas_obra" | "valor_total">): Array<{ horas: number; valor: number }> {
  const n = m2EquivalentePorTrecho.length;
  if (n === 0) return [];

  const pesos = m2EquivalentePorTrecho.map((m) => Math.max(0, Number(m) || 0));
  const total = pesos.reduce((acc, p) => acc + p, 0);
  const fracoes = pesos.map((p) => (total > 0 ? p / total : 1 / n));

  const partes = fracoes.map((f) => ({ horas: round2(f * maoObra.horas_obra), valor: round2(f * maoObra.valor_total) }));
  const ultimo = partes[n - 1];
  ultimo.horas = round2(ultimo.horas + (maoObra.horas_obra - partes.reduce((acc, p) => acc + p.horas, 0)));
  ultimo.valor = round2(ultimo.valor + (maoObra.valor_total - partes.reduce((acc, p) => acc + p.valor, 0)));
  return partes;
}
