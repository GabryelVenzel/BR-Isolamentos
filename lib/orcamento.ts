// Cálculo financeiro final do orçamento.
//
// Método de precificação: markup divisor (margem e impostos como % do PREÇO DE
// VENDA, não do custo). É o método padrão de precificação de serviços no Brasil —
// garante que `margem_lucro_padrao%` seja de fato a margem sobre o valor cobrado do
// cliente, e não uma margem "inflada" sobre o custo que produz uma margem real menor
// depois que os impostos (também um % do preço de venda) são descontados:
//
//   custoTotal = materiais + mão de obra + deslocamento + hospedagem + frete
//   percentual = percentualImpostos + percentualMargem   (ambos % do preço de venda)
//   precoCheio = custoTotal / (1 - percentual/100)
//   valorImpostos = precoCheio * percentualImpostos/100
//   margemLucro   = precoCheio * percentualMargem/100
//   valorDesconto = precoCheio * descontoPercentual/100
//   valorFinal    = precoCheio - valorDesconto

import { calcularAliquotaSimplesNacional } from "./tributos";
import type {
  CalcularOrcamentoInput,
  CalcularOrcamentoResultado,
  ItemDetalhamentoImposto,
  PrecoConfig,
  QuantificarResultado,
  TipoMaterialPreco,
} from "./types";

function precoPorTipo(precos: PrecoConfig[], tipo: TipoMaterialPreco): number {
  const preco = precos.find((p) => p.tipo_material === tipo && p.ativo);
  return preco?.preco_unitario ?? 0;
}

/** Erro esperado (não um bug) — mensagem pronta para mostrar ao usuário. */
export class OrcamentoConfigError extends Error {}

export interface DetalhamentoMateriais {
  detalhamento: CalcularOrcamentoResultado["detalhamento_materiais"];
  total: number;
}

/** Preço dos materiais para uma quantificação (Método Expert em kg) —
 * usado só para orçamentos anteriores à migração 010 (ver `calcularOrcamento`
 * abaixo); orçamentos novos passam `valor_materiais_direto` e não chamam
 * esta função. */
export function detalharValorMateriais(
  quantificacao: QuantificarResultado,
  precos: PrecoConfig[]
): DetalhamentoMateriais {
  const itens: Array<{ tipo: TipoMaterialPreco; quantidade: number }> = [
    { tipo: "manta", quantidade: quantificacao.manta_kg },
    { tipo: "chapa", quantidade: quantificacao.chapa_kg },
    { tipo: "rebite", quantidade: quantificacao.rebites },
    { tipo: "parafuso", quantidade: quantificacao.parafusos },
    { tipo: "arame", quantidade: quantificacao.arame_kg },
    { tipo: "vedacao", quantidade: quantificacao.vedacao_pu },
    { tipo: "vedacit", quantidade: quantificacao.vedacit_un },
  ];

  const detalhamento = itens.map(({ tipo, quantidade }) => {
    const precoUnitario = precoPorTipo(precos, tipo);
    return {
      tipo,
      quantidade,
      preco_unitario: precoUnitario,
      total: Number((quantidade * precoUnitario).toFixed(2)),
    };
  });

  return { detalhamento, total: detalhamento.reduce((acc, item) => acc + item.total, 0) };
}

export function calcularOrcamento(input: CalcularOrcamentoInput): CalcularOrcamentoResultado {
  const { quantificacao, precos, config, impostosExtras } = input;

  // Dois caminhos possíveis para o custo de materiais — ver comentário em
  // `CalcularOrcamentoInput` (lib/types.ts). `valor_materiais_direto` é o
  // caminho novo (precificação por m², migração 010); `quantificacao`+
  // `precos` é o Método Expert em kg, mantido para orçamentos antigos.
  const { detalhamento: detalhamentoMateriais, total: valorMateriais } =
    input.valor_materiais_direto !== undefined
      ? { detalhamento: [], total: input.valor_materiais_direto }
      : detalharValorMateriais(quantificacao ?? { manta_kg: 0, chapa_kg: 0, rebites: 0, parafusos: 0, arame_kg: 0, vedacao_pu: 0, vedacit_un: 0 }, precos ?? []);
  const valorMaoObra = input.horas_mao_obra * config.valor_hora_mao_obra;
  const valorDeslocamento = input.km_deslocamento * config.valor_km_deslocamento;
  const valorHospedagem = input.noites_hospedagem * config.valor_noite_hospedagem;
  const valorFrete = input.toneladas_frete * config.valor_frete_por_tonelada;

  const custoTotal = valorMateriais + valorMaoObra + valorDeslocamento + valorHospedagem + valorFrete;

  // --- Percentual de impostos "base", conforme o regime tributário ---
  const detalhamentoImpostosBase: Array<{ nome: string; percentual: number }> = [];

  if (config.regime_tributario === "simples_nacional") {
    const aliquota = calcularAliquotaSimplesNacional(
      config.simples_nacional_rbt12,
      config.simples_nacional_anexo
    );
    if (!aliquota) {
      throw new OrcamentoConfigError(
        "Configure o RBT12 (receita bruta dos últimos 12 meses) em Configurar Preços antes de gerar orçamentos — o Simples Nacional precisa desse valor para calcular a alíquota correta."
      );
    }
    detalhamentoImpostosBase.push({
      nome: `Simples Nacional (DAS, Anexo ${config.simples_nacional_anexo})`,
      percentual: aliquota.aliquotaEfetivaPercentual,
    });
  }
  // Lucro Presumido e Personalizado não têm imposto "base" fixo — tudo vem de
  // `impostosExtras` (para Lucro Presumido, a tela de configuração já pré-popula PIS/
  // COFINS/ISS/IRPJ/CSLL como itens editáveis dessa lista).

  for (const imposto of impostosExtras) {
    if (!imposto.ativo) continue;
    detalhamentoImpostosBase.push({ nome: imposto.nome, percentual: imposto.percentual });
  }

  const percentualImpostos = detalhamentoImpostosBase.reduce((acc, i) => acc + i.percentual, 0);
  const percentualMargem = config.margem_lucro_padrao;
  // "Desconto competitivo padrão" saiu da tela Configurar Preços (pedido
  // explícito) — sem desconto extra informado no orçamento, o padrão passa
  // a ser 0%, não mais um valor configurável escondido (ver
  // ConfigEmpresa.desconto_competitivo, @deprecated).
  const descontoPercentual = input.desconto_percentual_extra ?? 0;

  const percentualTotal = percentualImpostos + percentualMargem;
  if (percentualTotal >= 100) {
    throw new OrcamentoConfigError(
      `A soma de impostos (${percentualImpostos.toFixed(1)}%) e margem de lucro (${percentualMargem.toFixed(1)}%) atingiu ${percentualTotal.toFixed(1)}% — isso tornaria o preço de venda infinito ou negativo. Ajuste os percentuais em Configurar Preços.`
    );
  }

  const precoCheio = custoTotal / (1 - percentualTotal / 100);

  const round2 = (n: number) => Number(n.toFixed(2));

  const detalhamentoImpostos: ItemDetalhamentoImposto[] = detalhamentoImpostosBase.map((i) => ({
    nome: i.nome,
    percentual: i.percentual,
    valor: round2(precoCheio * (i.percentual / 100)),
  }));

  const totalImpostos = detalhamentoImpostos.reduce((acc, i) => acc + i.valor, 0);
  const margemLucro = round2(precoCheio * (percentualMargem / 100));
  const valorDesconto = round2(precoCheio * (descontoPercentual / 100));
  const valorFinal = round2(precoCheio - valorDesconto);

  return {
    valor_materiais: round2(valorMateriais),
    valor_mao_obra: round2(valorMaoObra),
    valor_deslocamento: round2(valorDeslocamento),
    valor_hospedagem: round2(valorHospedagem),
    valor_frete: round2(valorFrete),
    subtotal: round2(custoTotal),
    detalhamento_impostos: detalhamentoImpostos,
    total_impostos: round2(totalImpostos),
    percentual_impostos: round2(percentualImpostos),
    margem_lucro: margemLucro,
    percentual_margem: round2(percentualMargem),
    valor_desconto: valorDesconto,
    preco_cheio: round2(precoCheio),
    valor_final: valorFinal,
    detalhamento_materiais: detalhamentoMateriais,
  };
}
