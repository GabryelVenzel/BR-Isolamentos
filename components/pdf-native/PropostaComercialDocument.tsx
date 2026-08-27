// Versão NATIVA (vetorial) da Proposta Comercial — ver comentário no topo de
// PropostaTecnicaDocument.tsx pra decisão geral. Mesmas seções de
// components/PDFPreviewComercial.tsx (mantido só pro preview em tela).
//
// Estrutura elaborada (pedido "PROPOSTAS TÉCNICA E COMERCIAL ELABORADAS" +
// complemento "PROPOSTAS DIFERENCIADAS POR TIPO") — DECISÃO DE ARQUITETURA:
// o pedido descreve "6 variações" de proposta (Material+MO/Somente MO ×
// Quente/Frio/Mista). Em vez de 6 templates hardcoded (muita duplicação de
// texto, alto risco de divergência entre eles), este documento é UM template
// que se adapta aos dados reais do orçamento — filtra itens por
// `tipo_trabalho` (o mesmo padrão que a Proposta Técnica já usava) e ramifica
// texto/seções por `orcamento.tipo_proposta`. Uma proposta "mista" já sai
// com as duas seções (quente e frio) automaticamente, sem template dedicado.
//
// Os números de política comercial citados no pedido original (desconto à
// vista, garantia, reajuste tarifário assumido na projeção de 10 anos, fator
// de CO₂/árvore) vêm de `configEmpresa` (migração 020), nunca hardcoded — ver
// decisão 2 em sql-migration-020-detalhamento-propostas.sql.

import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import {
  arvoresEquivalentes,
  calcularBeneficiosConsolidados,
  calcularPaybackDias,
  calcularPaybackMeses,
  prazoExecucaoDiasUteis,
  projetarEconomiaAcumulada,
  temAnaliseFinanceira,
} from "@/lib/usecases/orcamento";
import { CORES, estilos } from "./estilos";
import type { ConfigEmpresa, Orcamento } from "@/lib/types";

interface Props {
  orcamento: Orcamento;
  configEmpresa?: ConfigEmpresa | null;
}

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };

function Cabecalho({ orcamento }: { orcamento: Orcamento }) {
  return (
    <View fixed>
      <View style={estilos.cabecalhoLinha}>
        <View>
          <Text style={estilos.marca}>BR ISOLAMENTOS</Text>
          <Text style={estilos.titulo}>PROPOSTA DE ORÇAMENTO</Text>
        </View>
        <View style={estilos.cabecalhoDireita}>
          <Text style={estilos.cabecalhoNumero}>Nº {orcamento.numero}</Text>
          <Text style={estilos.cabecalhoTexto}>{formatarData(orcamento.data_criacao)}</Text>
          <Text style={estilos.cabecalhoTexto}>{LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}</Text>
        </View>
      </View>
      <View style={estilos.divisorMarca} />
    </View>
  );
}

function Rodape({ configEmpresa }: { configEmpresa?: ConfigEmpresa | null }) {
  const contato = [configEmpresa?.telefone_empresa, configEmpresa?.email_empresa].filter(Boolean).join("  ·  ");
  return (
    <View style={estilos.rodape} fixed>
      <View style={estilos.rodapeDivisor} />
      <Text style={estilos.rodapeMarca}>BR Isolamentos — Soluções em Isolamentos Térmicos</Text>
      {contato && <Text style={estilos.rodapeContato}>{contato}</Text>}
      <Text style={estilos.rodapeObs}>
        Proposta comercial preparada especialmente para o cliente acima. Orçamento válido por 30 dias. Cálculos
        conforme normas ASTM C680, ISO 12241 e ABNT NBR 16281.
      </Text>
    </View>
  );
}

function Linha({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <View style={estilos.linhaFinanceira}>
      <Text style={estilos.linhaFinanceiraLabel}>{label}</Text>
      <Text style={destaque ? { ...estilos.linhaFinanceiraValor, color: estilos.totalValor.color } : estilos.linhaFinanceiraValor}>
        {valor}
      </Text>
    </View>
  );
}

export default function PropostaComercialDocument({ orcamento, configEmpresa }: Props) {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const ehLegado = itens.length > 0 && itens[0].manta_kg != null;
  const totalHoras = itens.reduce((acc, i) => acc + (i.horas_mao_obra ?? 0), 0);
  const somenteMaoObra = orcamento.tipo_proposta === "somente_mo";

  const temCustosOperacionais =
    orcamento.valor_mao_obra > 0 || orcamento.valor_deslocamento > 0 || orcamento.valor_hospedagem > 0 || orcamento.valor_frete > 0;

  const { economiaAnualTotal, co2ToneladasAno } = calcularBeneficiosConsolidados(itens);

  // Detalhamento por material persistido desde a migração 020 (ver
  // lib/usecases/orcamento/precificarTrecho.ts) — orçamentos criados antes
  // dela (ou "somente_mo") caem no resumo agregado mais simples abaixo.
  const itensComDetalhamento = itens.filter((i) => (i.detalhamento_materiais?.length ?? 0) > 0);
  const temDetalhamentoNovo = !somenteMaoObra && itensComDetalhamento.length > 0;

  const temFinanceiro = temAnaliseFinanceira(orcamento, economiaAnualTotal);
  const paybackMeses = !somenteMaoObra && temFinanceiro ? calcularPaybackMeses(orcamento.valor_final, economiaAnualTotal) : null;
  const paybackDias = somenteMaoObra && temFinanceiro ? calcularPaybackDias(orcamento.valor_final, economiaAnualTotal) : null;
  const reajuste = configEmpresa?.projecao_reajuste_tarifario_percentual ?? 3;
  const projecaoDezAnos = !somenteMaoObra && economiaAnualTotal > 0 ? projetarEconomiaAcumulada(economiaAnualTotal, reajuste, 10) : [];
  const arvores = arvoresEquivalentes(co2ToneladasAno, configEmpresa?.co2_kg_por_arvore_ano ?? 22);
  const prazoDias = configEmpresa ? prazoExecucaoDiasUteis(itens, configEmpresa.horas_uteis_dia) : null;
  const descontoAvista = configEmpresa?.desconto_avista_percentual ?? 5;
  const garantiaMeses = configEmpresa?.garantia_mao_obra_meses ?? 12;

  return (
    <Document title={`Proposta Comercial ${orcamento.numero}`}>
      <Page size="A4" style={estilos.pagina} wrap>
        <Cabecalho orcamento={orcamento} />

        <View style={estilos.caixaCliente}>
          <Text style={estilos.secaoTitulo}>Cliente</Text>
          <Text style={estilos.caixaClienteNome}>{orcamento.cliente?.nome}</Text>
          {orcamento.cliente?.cnpj_cpf && <Text style={estilos.caixaClienteLinha}>{orcamento.cliente.cnpj_cpf}</Text>}
          {orcamento.cliente?.endereco && <Text style={estilos.caixaClienteLinha}>{orcamento.cliente.endereco}</Text>}
          <Text style={estilos.caixaClienteLinha}>
            {[orcamento.cliente?.telefone, orcamento.cliente?.email].filter(Boolean).join("  ·  ")}
          </Text>
        </View>

        <View style={estilos.secao} wrap={false}>
          <Text style={estilos.secaoTitulo}>Especificações Técnicas</Text>
          <View style={estilos.tabela}>
            <View style={estilos.linhaCabecalho}>
              <Text style={estilos.celulaCabecalho}>Trecho</Text>
              <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Material</Text>
              <Text style={estilos.celulaCabecalho}>Tipo</Text>
              <Text style={estilos.celulaCabecalho}>Geometria</Text>
              <Text style={estilos.celulaCabecalho}>Área</Text>
              <Text style={estilos.celulaCabecalho}>Espessura</Text>
            </View>
            {itens.map((item, index) => (
              <View key={item.id} style={estilos.linha}>
                <Text style={estilos.celula}>
                  {index + 1}
                  {item.acabamento ? ` (${item.acabamento})` : ""}
                </Text>
                <Text style={{ ...estilos.celula, flex: 2 }}>{item.material}</Text>
                <Text style={estilos.celula}>{LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho}</Text>
                <Text style={estilos.celula}>{item.geometria === "tubulacao" ? "Tubulação" : "Sup. plana"}</Text>
                <Text style={estilos.celula}>{formatarNumero(item.area_m2)} m²</Text>
                <Text style={estilos.celula}>{formatarNumero(item.espessura_necessaria_mm, 1)} mm</Text>
              </View>
            ))}
          </View>
        </View>

        {somenteMaoObra ? (
          <View style={estilos.secao} wrap={false}>
            <Text style={estilos.secaoTitulo}>Quantificação de Mão de Obra</Text>
            <Text style={{ ...estilos.paragrafo, fontSize: 8, marginBottom: 6 }}>
              Proposta "Somente Mão de Obra" — o material é fornecido pelo cliente e não entra neste investimento.
            </Text>
            <View style={estilos.tabela}>
              <View style={estilos.linhaCabecalho}>
                <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Trecho</Text>
                <Text style={estilos.celulaCabecalho}>Horas</Text>
                <Text style={estilos.celulaCabecalho}>Valor/hora</Text>
                <Text style={estilos.celulaCabecalho}>Subtotal</Text>
              </View>
              {itens.map((item, index) => (
                <View key={item.id} style={estilos.linha}>
                  <Text style={{ ...estilos.celula, flex: 2 }}>
                    Trecho {index + 1} ({LABEL_TIPO[item.tipo_trabalho]})
                  </Text>
                  <Text style={estilos.celula}>{formatarNumero(item.horas_mao_obra ?? 0, 1)} h</Text>
                  <Text style={estilos.celula}>
                    {formatarMoeda(item.horas_mao_obra > 0 ? item.subtotal_mao_obra / item.horas_mao_obra : 0)}
                  </Text>
                  <Text style={estilos.celula}>{formatarMoeda(item.subtotal_mao_obra)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : temDetalhamentoNovo ? (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Quantificação de Materiais e Mão de Obra</Text>
            {itens.map((item, index) => {
              // Índice preservado do trecho original (não do array filtrado)
              // pra "Trecho N" continuar batendo com a tabela de
              // Especificações Técnicas acima, mesmo pulando trechos sem
              // detalhamento nem mão de obra.
              if ((item.detalhamento_materiais?.length ?? 0) === 0 && item.horas_mao_obra <= 0) return null;
              return (
                <View key={item.id} style={{ marginBottom: 10 }} wrap={false}>
                  {itens.length > 1 && (
                    <Text style={estilos.blocoTitulo}>
                      Trecho {index + 1} — {item.material}
                    </Text>
                  )}
                  <View style={estilos.tabela}>
                    <View style={estilos.linhaCabecalho}>
                      <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Item</Text>
                      <Text style={estilos.celulaCabecalho}>Qtd.</Text>
                      <Text style={estilos.celulaCabecalho}>Preço unit.</Text>
                      <Text style={estilos.celulaCabecalho}>Subtotal</Text>
                    </View>
                    {item.detalhamento_materiais.map((linha, i) => (
                      <View key={i} style={estilos.linha}>
                        <Text style={{ ...estilos.celula, flex: 2 }}>{linha.titulo}</Text>
                        <Text style={estilos.celula}>
                          {formatarNumero(linha.quantidade, linha.unidade === "g" ? 1 : 2)} {linha.unidade}
                        </Text>
                        <Text style={estilos.celula}>{formatarMoeda(linha.preco_unitario)}</Text>
                        <Text style={estilos.celula}>{formatarMoeda(linha.subtotal)}</Text>
                      </View>
                    ))}
                    {item.horas_mao_obra > 0 && (
                      <View style={estilos.linha}>
                        <Text style={{ ...estilos.celula, flex: 2 }}>Mão de obra (dupla)</Text>
                        <Text style={estilos.celula}>{formatarNumero(item.horas_mao_obra, 1)} h</Text>
                        <Text style={estilos.celula}>
                          {formatarMoeda(item.horas_mao_obra > 0 ? item.subtotal_mao_obra / item.horas_mao_obra : 0)}
                        </Text>
                        <Text style={estilos.celula}>{formatarMoeda(item.subtotal_mao_obra)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={{ borderTopWidth: 1, borderTopColor: CORES.cinzaMuitoClaro, paddingTop: 4 }}>
              <Linha label="Subtotal Materiais" valor={formatarMoeda(orcamento.valor_materiais)} />
              <Linha label={`Subtotal Mão de Obra (${formatarNumero(totalHoras, 1)}h)`} valor={formatarMoeda(orcamento.valor_mao_obra)} />
            </View>
          </View>
        ) : (
          !ehLegado &&
          itens.length > 0 && (
            <View style={estilos.secao} wrap={false}>
              <Text style={estilos.secaoTitulo}>Materiais por Trecho (R$/m²)</Text>
              <View style={estilos.tabela}>
                <View style={estilos.linhaCabecalho}>
                  <Text style={estilos.celulaCabecalho}>Trecho</Text>
                  <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Isolante</Text>
                  <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Acabamento</Text>
                  <Text style={estilos.celulaCabecalho}>Metragem</Text>
                  <Text style={estilos.celulaCabecalho}>Mão de obra</Text>
                </View>
                {itens.map((item, index) => (
                  <View key={item.id} style={estilos.linha}>
                    <Text style={estilos.celula}>{index + 1}</Text>
                    <Text style={{ ...estilos.celula, flex: 2 }}>{item.material}</Text>
                    <Text style={{ ...estilos.celula, flex: 2 }}>{item.acabamento ?? "—"}</Text>
                    <Text style={estilos.celula}>{formatarNumero(item.area_m2)} m²</Text>
                    <Text style={estilos.celula}>{formatarNumero(item.horas_mao_obra ?? 0, 1)}h</Text>
                  </View>
                ))}
              </View>

              <Text style={{ ...estilos.paragrafo, fontSize: 8, marginTop: 8, marginBottom: 4 }}>
                O valor apresentado divide-se em Material e Mão de Obra, ambos com a mesma margem de lucro, conforme
                segue:
              </Text>
              <Linha label="Material (isolante + acabamentos)" valor={formatarMoeda(orcamento.valor_materiais)} />
              <Linha label={`Mão de obra (${formatarNumero(totalHoras, 1)}h)`} valor={formatarMoeda(orcamento.valor_mao_obra)} />
            </View>
          )
        )}

        {temCustosOperacionais && (
          <View style={estilos.secao} wrap={false}>
            <Text style={estilos.secaoTitulo}>Custos Operacionais</Text>
            {orcamento.valor_mao_obra > 0 && ehLegado && <Linha label="Mão de obra" valor={formatarMoeda(orcamento.valor_mao_obra)} />}
            {orcamento.valor_deslocamento > 0 && <Linha label="Deslocamento" valor={formatarMoeda(orcamento.valor_deslocamento)} />}
            {orcamento.valor_hospedagem > 0 && <Linha label="Hospedagem" valor={formatarMoeda(orcamento.valor_hospedagem)} />}
            {orcamento.valor_frete > 0 && <Linha label="Frete" valor={formatarMoeda(orcamento.valor_frete)} />}
          </View>
        )}

        <View style={estilos.totalCaixa} wrap={false}>
          <Text style={estilos.secaoTitulo}>Resumo Financeiro</Text>
          <Linha label="Subtotal (materiais + serviços)" valor={formatarMoeda(orcamento.subtotal)} />
          {(orcamento.detalhamento_impostos ?? []).map((imposto) => (
            <Linha key={imposto.nome} label={`(+) ${imposto.nome} (${imposto.percentual.toFixed(2)}%)`} valor={formatarMoeda(imposto.valor)} />
          ))}
          <Linha label="(+) Margem de lucro" valor={formatarMoeda(orcamento.margem_lucro)} />
          {orcamento.valor_desconto > 0 && <Linha label="(-) Desconto comercial" valor={`- ${formatarMoeda(orcamento.valor_desconto)}`} />}
          <View style={estilos.totalLinha}>
            <Text style={estilos.totalLabel}>Valor Total</Text>
            <Text style={estilos.totalValor}>{formatarMoeda(orcamento.valor_final)}</Text>
          </View>
        </View>

        {!somenteMaoObra && paybackMeses != null && (
          <View style={estilos.caixaRoi} wrap={false}>
            <Text style={estilos.roiTitulo}>Análise de Retorno do Investimento</Text>
            <View style={estilos.roiLinhaGrande}>
              <Text style={estilos.roiLabelGrande}>Investimento</Text>
              <Text style={estilos.roiValorGrande}>{formatarMoeda(orcamento.valor_final)}</Text>
            </View>
            <View style={estilos.roiLinhaGrande}>
              <Text style={estilos.roiLabelGrande}>Economia anual estimada</Text>
              <Text style={estilos.roiValorGrande}>{formatarMoeda(economiaAnualTotal)}</Text>
            </View>
            <View style={estilos.roiLinhaGrande}>
              <Text style={estilos.roiLabelGrande}>Payback estimado</Text>
              <Text style={estilos.roiValorGrande}>{formatarNumero(paybackMeses, 1)} meses</Text>
            </View>
            <Text style={estilos.notaRodape}>
              Estimativa com base na economia de energia calculada para os trechos quentes desta proposta (ver
              Proposta Técnica). Considera o valor investido total, sem reajuste tarifário.
            </Text>
          </View>
        )}

        {somenteMaoObra && paybackDias != null && (
          <View style={estilos.caixaRoi} wrap={false}>
            <Text style={estilos.roiTitulo}>Retorno do Investimento em Mão de Obra</Text>
            <View style={estilos.roiLinhaGrande}>
              <Text style={estilos.roiLabelGrande}>Investimento em mão de obra</Text>
              <Text style={estilos.roiValorGrande}>{formatarMoeda(orcamento.valor_final)}</Text>
            </View>
            <View style={estilos.roiLinhaGrande}>
              <Text style={estilos.roiLabelGrande}>Economia anual estimada</Text>
              <Text style={estilos.roiValorGrande}>{formatarMoeda(economiaAnualTotal)}</Text>
            </View>
            <View style={estilos.roiLinhaGrande}>
              <Text style={estilos.roiLabelGrande}>Payback estimado</Text>
              <Text style={estilos.roiValorGrande}>{paybackDias} dias</Text>
            </View>
            <Text style={estilos.notaRodape}>
              Material já fornecido pelo cliente — o investimento considerado aqui é só a mão de obra desta proposta.
            </Text>
          </View>
        )}

        {projecaoDezAnos.length > 0 && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Projeção de Economia Acumulada (10 anos)</Text>
            <Text style={{ ...estilos.paragrafo, fontSize: 8, marginBottom: 6 }}>
              {reajuste > 0
                ? `Projeção com reajuste tarifário estimado de ${formatarNumero(reajuste, 1)}% ao ano — estimativa de mercado, não uma garantia contratual.`
                : "Projeção com economia anual constante (sem reajuste tarifário assumido)."}
            </Text>
            <View style={estilos.tabela}>
              <View style={estilos.linhaCabecalho}>
                <Text style={estilos.celulaCabecalho}>Ano</Text>
                <Text style={estilos.celulaCabecalho}>Economia do ano</Text>
                <Text style={estilos.celulaCabecalho}>Acumulado</Text>
              </View>
              {projecaoDezAnos.map((linha) => (
                <View key={linha.ano} style={estilos.linha}>
                  <Text style={estilos.celula}>{linha.ano}</Text>
                  <Text style={estilos.celula}>{formatarMoeda(linha.economiaDoAno)}</Text>
                  <Text style={estilos.celula}>{formatarMoeda(linha.acumulado)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(economiaAnualTotal > 0 || co2ToneladasAno > 0) && (
          <View style={{ ...estilos.blocoDestaque, marginTop: 4 }} wrap={false}>
            <Text style={estilos.secaoTitulo}>Benefícios Ambientais</Text>
            {economiaAnualTotal > 0 && (
              <Text style={estilos.listaItem}>• Economia anual estimada de energia: {formatarMoeda(economiaAnualTotal)}</Text>
            )}
            {co2ToneladasAno > 0 && (
              <Text style={estilos.listaItem}>• Redução de emissão de CO₂: {formatarNumero(co2ToneladasAno, 2)} toneladas/ano</Text>
            )}
            {arvores > 0 && (
              <Text style={estilos.listaItem}>
                • Equivalência ilustrativa: cerca de {arvores} {arvores === 1 ? "árvore plantada" : "árvores plantadas"} por ano
              </Text>
            )}
            <Text style={estilos.notaRodape}>
              Contribui para metas de sustentabilidade/ESG da operação. Equivalência de árvores é uma estimativa
              ilustrativa (fator configurável), não uma métrica de compensação de carbono certificada.
            </Text>
          </View>
        )}

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>Condições Comerciais</Text>

          <Text style={estilos.blocoTitulo}>Forma de pagamento</Text>
          <Text style={estilos.listaItem}>• À vista: {formatarNumero(descontoAvista, 0)}% de desconto</Text>
          <Text style={estilos.listaItem}>• 50% de entrada + 50% na conclusão dos trabalhos</Text>
          <Text style={estilos.listaItem}>• Parcelado: consulte condições</Text>

          <Text style={{ ...estilos.blocoTitulo, marginTop: 8 }}>Prazo de execução</Text>
          <Text style={estilos.paragrafo}>
            {prazoDias != null
              ? `${prazoDias} dia(s) útil(eis), estimado(s) a partir da mão de obra calculada para esta proposta.`
              : "A confirmar após aceite."}{" "}
            Data de início a combinar com o cliente.
          </Text>

          <Text style={{ ...estilos.blocoTitulo, marginTop: 8 }}>Garantias</Text>
          <Text style={estilos.listaItem}>• Mão de obra: {garantiaMeses} meses</Text>
          <Text style={estilos.listaItem}>• Materiais: conforme garantia do fabricante</Text>

          <Text style={{ ...estilos.blocoTitulo, marginTop: 8 }}>Responsabilidades</Text>
          <Text style={estilos.listaItem}>
            • BR Isolamentos: {somenteMaoObra ? "mão de obra especializada e execução conforme normas técnicas" : "fornecimento de materiais, mão de obra especializada e execução conforme normas técnicas"}
          </Text>
          <Text style={estilos.listaItem}>
            • Cliente: acesso seguro ao local, estrutura de apoio para trabalho em altura quando aplicável, segurança
            no canteiro de obras
          </Text>

          <Text style={{ ...estilos.blocoTitulo, marginTop: 8 }}>Não contemplado nesta proposta</Text>
          <Text style={estilos.listaItem}>• Modificações de escopo não descritas nesta proposta</Text>
          <Text style={estilos.listaItem}>• Estruturas de acesso para trabalho em altura (andaimes/plataformas), salvo se explicitamente incluídas</Text>
          <Text style={estilos.listaItem}>• Adequações civis/estruturais e remoção de isolamento antigo, salvo se explicitamente incluídas</Text>
        </View>

        <View style={estilos.secao} wrap={false}>
          <Text style={estilos.secaoTitulo}>Próximos Passos</Text>
          <Text style={estilos.listaItem}>1. Aprovação desta proposta comercial</Text>
          <Text style={estilos.listaItem}>2. Agendamento de mobilização</Text>
          <Text style={estilos.listaItem}>3. Execução dos trabalhos no prazo estimado</Text>
          <Text style={estilos.listaItem}>4. Comissionamento e conferência final</Text>
          <Text style={{ ...estilos.notaRodape, marginTop: 8 }}>
            Proposta sujeita a alterações por motivos climáticos, de acesso ao local ou força maior. Cálculos de
            economia baseados nos parâmetros informados no momento da elaboração — alterações tarifárias podem
            alterar os valores estimados.
          </Text>
        </View>

        <Rodape configEmpresa={configEmpresa} />
        <Text style={estilos.paginaNumero} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
