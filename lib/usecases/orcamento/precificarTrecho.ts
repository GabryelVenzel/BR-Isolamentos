// Precificação de um trecho (Tela 4 do wizard) e alocação proporcional do
// valor final do orçamento entre trechos (Tela 5/6) — puro, sem I/O.
//
// IMPORTANTE: a Tela 4 do pedido original mostrava um exemplo com margem
// fixa de 20% aplicada trecho a trecho. Isso NÃO é usado aqui — o motor de
// impostos/margem (lib/orcamento.ts#calcularOrcamento) já é sofisticado
// (regime tributário configurável, Simples Nacional com alíquota real por
// RBT12, impostos extras, margem configurável) e opera sobre o ORÇAMENTO
// INTEIRO, não trecho a trecho (o regime tributário não muda de trecho para
// trecho). Reaproveitar esse motor — em vez de aplicar uma margem ingênua
// de 20% por trecho — é o que preserva a exigência já validada com o
// usuário de que o cálculo considere a carga tributária real e completa.
// `alocarValorFinalPorTrecho` só REPARTE o resultado desse motor entre os
// trechos (proporcional ao custo de cada um), para exibição — não recalcula
// impostos/margem por conta própria.
//
// Migração 019 — motor de quantificação + mão de obra automática: o material
// não é mais "metragem × preço/m²" direto — cada material tem sua própria
// quantidade (isolante/acabamento com acréscimo, rebite/parafuso/arame/
// silicone por m²), e a mão de obra deixou de ser um número digitado pra
// virar um cálculo automático (eficiência × horas base). Ver
// quantificarMateriais.ts / calcularMaoObraAutomatica.ts.

import type { ItemEscopo, LinhaDetalhamentoMaterial } from "../../types";
import { somarMetragemEscopo, temCurvasNoEscopo, temTubulacaoPequena } from "./escopo";
import { calcularMaoObraAutomatica, type ParametrosMaoObra } from "./calcularMaoObraAutomatica";
import { quantificarMateriais, type ParametrosQuantificacao } from "./quantificarMateriais";

export interface PrecosAcessorios {
  /** R$ por unidade. */
  rebiteUn: number;
  /** R$ por unidade. */
  parafusoUn: number;
  /** R$ por metro (migração 029 — catálogo comercial passou a vender arame
   * por metro, não mais por peso; ver quantificarMateriais.ts). */
  arameMetro: number;
  /** R$ por frasco. */
  siliconeFrasco: number;
}

export interface PrecificacaoTrecho {
  metragem_m2: number;
  preco_isolante_m2: number;
  preco_acabamento_m2: number;
  horas_mao_obra: number;
  valor_hora_mao_obra: number;
  eficiencia_global: number;
  subtotal_material: number;
  subtotal_mao_obra: number;
  subtotal_trecho: number;
  /** Quantidades cruas (sem preço) — só apoio de cálculo/exibição na Tela 4. */
  quantidades: ReturnType<typeof quantificarMateriais>;
  /** Mesmas linhas de `quantidades`, já com preço/subtotal e prontas para
   * persistir (migração 020, `ItemOrcamento.detalhamento_materiais`) — a
   * Tela 4 sobrescreve `titulo` (nome real do material/acabamento escolhido,
   * que esta função não conhece) e os valores de linhas com override antes
   * de salvar. Vazio quando `tipoProposta === "somente_mo"` ou quando a
   * quantidade calculada é zero (acessório não usado pela empresa). */
  detalhamentoMateriais: LinhaDetalhamentoMaterial[];
}

export function precificarTrecho(input: {
  escopoItens: ItemEscopo[];
  /** Espessura de isolante do trecho (mm) — do cálculo térmico (quente) ou
   * da espessura mínima calculada (frio); 0 em material customizado sem
   * cálculo térmico. Só usada pra achar o diâmetro já isolado de itens
   * tubulação/curva na quantificação (migração 023, ver
   * quantificarMateriais.ts) — não afeta preço nem mão de obra. */
  espessuraMm: number;
  /** "somente_mo" zera a quantificação/custo de material inteiro — só mão de
   * obra entra no subtotal (pedido explícito, ver Orcamento.tipo_proposta). */
  tipoProposta: "material_mo" | "somente_mo";
  precoIsolanteM2: number;
  precoAcabamentoM2: number;
  precosAcessorios: PrecosAcessorios;
  valorHoraMaoObra: number;
  trabalhoAltura: boolean;
  parametrosQuantificacao: ParametrosQuantificacao;
  parametrosMaoObra: ParametrosMaoObra;
}): PrecificacaoTrecho {
  const metragem = somarMetragemEscopo(input.escopoItens);
  const round2 = (n: number) => Number(n.toFixed(2));

  const quantidades = quantificarMateriais(input.escopoItens, input.espessuraMm, input.parametrosQuantificacao);

  const maoObra = calcularMaoObraAutomatica(
    metragem,
    {
      tubulacaoPequena: temTubulacaoPequena(input.escopoItens),
      temCurvas: temCurvasNoEscopo(input.escopoItens),
      trabalhoAltura: input.trabalhoAltura,
    },
    input.parametrosMaoObra
  );

  const subtotalMaterial =
    input.tipoProposta === "somente_mo"
      ? 0
      : round2(
          quantidades.isolanteM2 * input.precoIsolanteM2 +
            quantidades.acabamentoM2 * input.precoAcabamentoM2 +
            quantidades.rebiteUn * input.precosAcessorios.rebiteUn +
            quantidades.parafusoUn * input.precosAcessorios.parafusoUn +
            quantidades.arameMetros * input.precosAcessorios.arameMetro +
            quantidades.siliconeFrascos * input.precosAcessorios.siliconeFrasco
        );

  const subtotalMaoObra = round2(maoObra.horasAjustadas * input.valorHoraMaoObra);

  const detalhamentoMateriais: LinhaDetalhamentoMaterial[] =
    input.tipoProposta === "somente_mo"
      ? []
      : (
          [
            { chave: "isolante", titulo: "Isolante", quantidade: quantidades.isolanteM2, unidade: "m²", preco_unitario: input.precoIsolanteM2 },
            { chave: "acabamento", titulo: "Acabamento", quantidade: quantidades.acabamentoM2, unidade: "m²", preco_unitario: input.precoAcabamentoM2 },
            { chave: "rebite", titulo: "Rebite", quantidade: quantidades.rebiteUn, unidade: "un.", preco_unitario: input.precosAcessorios.rebiteUn },
            { chave: "parafuso", titulo: "Parafuso", quantidade: quantidades.parafusoUn, unidade: "un.", preco_unitario: input.precosAcessorios.parafusoUn },
            { chave: "arame", titulo: "Arame", quantidade: quantidades.arameMetros, unidade: "m", preco_unitario: input.precosAcessorios.arameMetro },
            { chave: "silicone", titulo: "Silicone", quantidade: quantidades.siliconeFrascos, unidade: "frasco(s)", preco_unitario: input.precosAcessorios.siliconeFrasco },
          ] as const
        )
          .filter((l) => l.quantidade > 0)
          .map((l) => ({ ...l, subtotal: round2(l.quantidade * l.preco_unitario) }));

  return {
    metragem_m2: metragem,
    preco_isolante_m2: input.precoIsolanteM2,
    preco_acabamento_m2: input.precoAcabamentoM2,
    horas_mao_obra: maoObra.horasAjustadas,
    valor_hora_mao_obra: input.valorHoraMaoObra,
    eficiencia_global: maoObra.eficienciaGlobal,
    subtotal_material: subtotalMaterial,
    subtotal_mao_obra: subtotalMaoObra,
    subtotal_trecho: round2(subtotalMaterial + subtotalMaoObra),
    quantidades,
    detalhamentoMateriais,
  };
}

export interface TrechoParaAlocacao {
  subtotal_material: number;
  subtotal_mao_obra: number;
}

/** Reparte `valorFinalOrcamento` (já com impostos/margem/desconto do motor
 * completo) entre os trechos, proporcional ao custo (material + mão de obra)
 * de cada um — mesma % de imposto/margem "embutida" pra todos os trechos,
 * já que vem de um único cálculo por orçamento. Última linha absorve o
 * arredondamento, para a soma bater exatamente com o valor final. */
export function alocarValorFinalPorTrecho(trechos: TrechoParaAlocacao[], valorFinalOrcamento: number): number[] {
  const custos = trechos.map((t) => t.subtotal_material + t.subtotal_mao_obra);
  const custoTotal = custos.reduce((acc, c) => acc + c, 0);

  if (custoTotal <= 0) return trechos.map(() => 0);

  const valores = custos.map((c) => Number(((c / custoTotal) * valorFinalOrcamento).toFixed(2)));
  const diferenca = Number((valorFinalOrcamento - valores.reduce((acc, v) => acc + v, 0)).toFixed(2));
  valores[valores.length - 1] = Number((valores[valores.length - 1] + diferenca).toFixed(2));
  return valores;
}
