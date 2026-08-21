// Cálculo financeiro final do orçamento — segue o fluxo do prompt original:
// materiais -> custos operacionais -> subtotal -> impostos (ISS + INSS)
// -> margem de lucro -> desconto -> valor final.

import type {
  CalcularOrcamentoInput,
  CalcularOrcamentoResultado,
  TipoMaterialPreco,
} from "./types";

function precoPorTipo(precos: CalcularOrcamentoInput["precos"], tipo: TipoMaterialPreco): number {
  const preco = precos.find((p) => p.tipo_material === tipo && p.ativo);
  return preco?.preco_unitario ?? 0;
}

export function calcularOrcamento(input: CalcularOrcamentoInput): CalcularOrcamentoResultado {
  const { quantificacao, precos, config, horas_mao_obra, km_deslocamento, noites_hospedagem, toneladas_frete } =
    input;

  const itens: Array<{ tipo: TipoMaterialPreco; quantidade: number }> = [
    { tipo: "manta", quantidade: quantificacao.manta_kg },
    { tipo: "chapa", quantidade: quantificacao.chapa_kg },
    { tipo: "rebite", quantidade: quantificacao.rebites },
    { tipo: "parafuso", quantidade: quantificacao.parafusos },
    { tipo: "arame", quantidade: quantificacao.arame_kg },
    { tipo: "vedacao", quantidade: quantificacao.vedacao_pu },
    { tipo: "vedacit", quantidade: quantificacao.vedacit_un },
  ];

  const detalhamentoMateriais = itens.map(({ tipo, quantidade }) => {
    const precoUnitario = precoPorTipo(precos, tipo);
    return {
      tipo,
      quantidade,
      preco_unitario: precoUnitario,
      total: Number((quantidade * precoUnitario).toFixed(2)),
    };
  });

  const valorMateriais = detalhamentoMateriais.reduce((acc, item) => acc + item.total, 0);

  const valorMaoObra = horas_mao_obra * config.valor_hora_mao_obra;
  const valorDeslocamento = km_deslocamento * config.valor_km_deslocamento;
  const valorHospedagem = noites_hospedagem * config.valor_noite_hospedagem;
  const valorFrete = toneladas_frete * config.valor_frete_por_tonelada;

  const subtotal = valorMateriais + valorMaoObra + valorDeslocamento + valorHospedagem + valorFrete;

  const valorIss = subtotal * (config.aliquota_iss_percentual / 100);
  const valorInss = subtotal * (config.aliquota_inss_percentual / 100);
  const totalImpostos = valorIss + valorInss;

  const baseComImpostos = subtotal + totalImpostos;
  const margemLucro = baseComImpostos * (config.margem_lucro_padrao / 100);

  const baseComMargem = baseComImpostos + margemLucro;
  const descontoPercentual = input.desconto_percentual_extra ?? config.desconto_competitivo;
  const valorDesconto = baseComMargem * (descontoPercentual / 100);

  const valorFinal = baseComMargem - valorDesconto;

  const round2 = (n: number) => Number(n.toFixed(2));

  return {
    valor_materiais: round2(valorMateriais),
    valor_mao_obra: round2(valorMaoObra),
    valor_deslocamento: round2(valorDeslocamento),
    valor_hospedagem: round2(valorHospedagem),
    valor_frete: round2(valorFrete),
    subtotal: round2(subtotal),
    valor_iss: round2(valorIss),
    valor_inss: round2(valorInss),
    total_impostos: round2(totalImpostos),
    margem_lucro: round2(margemLucro),
    valor_desconto: round2(valorDesconto),
    valor_final: round2(valorFinal),
    detalhamento_materiais: detalhamentoMateriais,
  };
}
