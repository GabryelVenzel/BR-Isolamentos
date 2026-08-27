// Versão NATIVA (vetorial) da Proposta Comercial — ver comentário no topo de
// PropostaTecnicaDocument.tsx pra decisão geral. Mesmas seções de
// components/PDFPreviewComercial.tsx (mantido só pro preview em tela).
//
// Estrutura elaborada ao longo de várias rodadas ("PROPOSTAS TÉCNICA E
// COMERCIAL ELABORADAS", "PROPOSTAS DIFERENCIADAS POR TIPO", "REFATORAÇÃO
// PROPOSTAS TÉCNICA E COMERCIAL", "AJUSTES NAS PROPOSTAS") — DECISÃO DE
// ARQUITETURA: os pedidos descrevem "6 variações" de proposta (Material+MO/
// Somente MO × Quente/Frio/Mista). Em vez de 6 templates hardcoded, este
// documento é UM template que se adapta aos dados reais do orçamento.
//
// ORDEM ATUAL DOS TÓPICOS (rodada "MAIS ALGUNS AJUSTES NOS PDFS"):
//   1. Escopo — mesmo conteúdo/formato da Proposta Técnica.
//   2. Especificações Técnicas — mesma tabela/nome da Proposta Técnica
//      (uma linha por item de Escopo, sem chaparia, Isolamento = material +
//      espessura).
//   3. Quantificação de Materiais e Mão de Obra — REINSERIDA nesta rodada
//      (tinha saído na rodada anterior), agora em 2 quadros: materiais com
//      quantidade (sem preço) e mão de obra/deslocamento/hospedagem/
//      alimentação como "Incluso" (sem quantidade nem valor).
//   4. ROI e Projeção Econômica — caixa de payback + projeção de 10 anos no
//      mesmo tópico.
//   5. Benefícios Ambientais.
//   6. Resumo Financeiro — MOVIDO pra depois de Benefícios (pedido
//      explícito); reduzido a Material + Mão de Obra + Total, sem impostos/
//      margem visíveis.
//   7. Condições Comerciais — sem "Não contemplado" (já coberto pelo tópico
//      1) e Responsabilidades empilhadas, não em duas colunas.
//   [Observações Adicionais, só quando preenchida]
//   8. Próximos Passos.

import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import {
  arvoresEquivalentes,
  calcularBeneficiosConsolidados,
  calcularPaybackDias,
  calcularPaybackMeses,
  distribuirResumoFinanceiroSimplificado,
  itensContemplados,
  itensNaoContemplados,
  linhasEspecificacoesTecnicas,
  linhasOperacionaisIncluso,
  linhasQuantificacaoMateriais,
  prazoExecucaoDiasUteis,
  projetarEconomiaAcumulada,
  temAnaliseFinanceira,
} from "@/lib/usecases/orcamento";
import { CORES, estilos } from "./estilos";
import CapaProposta from "./CapaProposta";
import type { ConfigEmpresa, Orcamento } from "@/lib/types";

interface ImagemProposta {
  url: string;
  legenda: string | null;
}

interface Props {
  orcamento: Orcamento;
  imagens?: ImagemProposta[];
  configEmpresa?: ConfigEmpresa | null;
}

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };
const LABEL_TIPO_COMPLETO: Record<string, string> = {
  quente: "Isolamento Térmico Quente",
  frio: "Isolamento Térmico Frio",
  misto: "Isolamento Térmico Misto (Quente + Frio)",
};
const LABEL_PROPOSTA: Record<string, string> = { material_mo: "Material + Mão de Obra", somente_mo: "Somente Mão de Obra" };

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
          <Text style={estilos.cabecalhoTexto}>{LABEL_TIPO_COMPLETO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}</Text>
        </View>
      </View>
      <View style={estilos.divisorMarca} />
    </View>
  );
}

function Rodape({ configEmpresa, validadeDias }: { configEmpresa?: ConfigEmpresa | null; validadeDias: number }) {
  const contato = [configEmpresa?.telefone_empresa, configEmpresa?.email_empresa].filter(Boolean).join("  ·  ");
  return (
    <View style={estilos.rodape} fixed>
      <View style={estilos.rodapeDivisor} />
      <Text style={estilos.rodapeMarca}>BR Isolamentos — Soluções em Isolamentos Térmicos</Text>
      {contato && <Text style={estilos.rodapeContato}>{contato}</Text>}
      <Text style={estilos.rodapeObs}>
        Proposta comercial preparada especialmente para o cliente acima. Orçamento válido por {validadeDias} dias.
        Cálculos conforme normas ASTM C680, ISO 12241 e ABNT NBR 16281.
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

const NOTA_ESTIMATIVA_COMPARATIVA =
  "Estimativa comparativa entre o cenário COM isolamento térmico (proposto) e o cenário SEM isolamento (situação atual), com base nos parâmetros informados nesta proposta — não é uma garantia contratual.";

export default function PropostaComercialDocument({ orcamento, imagens = [], configEmpresa }: Props) {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const somenteMaoObra = orcamento.tipo_proposta === "somente_mo";

  const { economiaAnualTotal, co2ToneladasAno } = calcularBeneficiosConsolidados(itens);
  const temFinanceiro = temAnaliseFinanceira(orcamento, economiaAnualTotal);
  const paybackMeses = !somenteMaoObra && temFinanceiro ? calcularPaybackMeses(orcamento.valor_final, economiaAnualTotal) : null;
  const paybackDias = somenteMaoObra && temFinanceiro ? calcularPaybackDias(orcamento.valor_final, economiaAnualTotal) : null;
  const reajuste = configEmpresa?.projecao_reajuste_tarifario_percentual ?? 3;
  const projecaoDezAnos = !somenteMaoObra && economiaAnualTotal > 0 ? projetarEconomiaAcumulada(economiaAnualTotal, reajuste, 10) : [];
  const arvores = arvoresEquivalentes(co2ToneladasAno, configEmpresa?.co2_kg_por_arvore_ano ?? 22);
  const prazoDias = configEmpresa ? prazoExecucaoDiasUteis(itens, configEmpresa.horas_uteis_dia) : null;
  const descontoAvista = configEmpresa?.desconto_avista_percentual ?? 5;
  const garantiaMeses = configEmpresa?.garantia_mao_obra_meses ?? 12;
  const validadeDias = configEmpresa?.validade_proposta_dias ?? 30;
  const formaPagamentoPadrao = configEmpresa?.forma_pagamento_padrao || "50% de entrada + 50% na conclusão dos trabalhos";
  const contempla = itensContemplados(orcamento.tipo_proposta);
  const naoContempla = itensNaoContemplados(orcamento.tipo_proposta);
  const linhasEspecificacoes = linhasEspecificacoesTecnicas(itens);
  const resumoSimplificado = distribuirResumoFinanceiroSimplificado(orcamento);
  const temTopicoRoi = economiaAnualTotal > 0;
  const quadroMateriais = linhasQuantificacaoMateriais(itens);
  const quadroOperacional = linhasOperacionaisIncluso(orcamento);

  let n = 1;

  return (
    <Document title={`Proposta Comercial ${orcamento.numero}`}>
      <CapaProposta tipo="comercial" orcamento={orcamento} />

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
          <Text style={estilos.caixaClienteLinha}>
            Escopo: {LABEL_PROPOSTA[orcamento.tipo_proposta] ?? orcamento.tipo_proposta} ·{" "}
            {LABEL_TIPO_COMPLETO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}
          </Text>
        </View>

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>{n++}. Escopo</Text>
          {itens.map((item, index) => (
            <View key={item.id} style={{ marginBottom: 4 }}>
              <Text style={estilos.blocoTitulo}>
                Trecho {index + 1} ({LABEL_TIPO[item.tipo_trabalho]})
                {item.trabalho_altura ? " · trabalho em altura" : ""}
              </Text>
              {(item.escopo_itens?.length ?? 0) > 0 ? (
                item.escopo_itens.map((escopo) => (
                  <Text key={escopo.id} style={estilos.listaItem}>
                    • {escopo.nome}
                  </Text>
                ))
              ) : (
                <Text style={estilos.listaItem}>{formatarNumero(item.area_m2)} m²</Text>
              )}
            </View>
          ))}
          <View style={{ marginTop: 10 }}>
            <Text style={{ ...estilos.blocoTitulo, fontSize: 9.5 }}>✅ O orçamento contempla</Text>
            {contempla.map((texto) => (
              <Text key={texto} style={estilos.listaItem}>
                • {texto}
              </Text>
            ))}
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={{ ...estilos.blocoTitulo, fontSize: 9.5, color: CORES.erro }}>❌ Não contemplado</Text>
            {naoContempla.map((texto) => (
              <Text key={texto} style={estilos.listaItem}>
                • {texto}
              </Text>
            ))}
          </View>
        </View>

        <View style={estilos.secao} wrap={false}>
          <Text style={estilos.secaoTitulo}>{n++}. Especificações Técnicas</Text>
          <View style={estilos.tabela}>
            <View style={estilos.linhaCabecalho}>
              <Text style={estilos.celulaCabecalho}>Trecho</Text>
              <Text style={estilos.celulaCabecalho}>Tipo</Text>
              <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Isolamento</Text>
              <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Descrição</Text>
              <Text style={estilos.celulaCabecalho}>Qtd.</Text>
              <Text style={estilos.celulaCabecalho}>Área</Text>
            </View>
            {linhasEspecificacoes.map((linha, i) => (
              <View key={i} style={estilos.linha}>
                <Text style={estilos.celula}>{linha.trechoNumero}</Text>
                <Text style={estilos.celula}>{LABEL_TIPO[linha.tipoTrabalho]}</Text>
                <Text style={{ ...estilos.celula, flex: 2 }}>{linha.isolamento}</Text>
                <Text style={{ ...estilos.celula, flex: 2 }}>{linha.descricao}</Text>
                <Text style={estilos.celula}>{linha.qtd}</Text>
                <Text style={estilos.celula}>{formatarNumero(linha.areaM2)} m²</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>{n++}. Quantificação de Materiais e Mão de Obra</Text>
          {!somenteMaoObra && quadroMateriais.length > 0 && (
            <>
              <Text style={estilos.blocoTitulo}>Materiais</Text>
              <View style={estilos.tabela}>
                <View style={estilos.linhaCabecalho}>
                  {itens.length > 1 && <Text style={estilos.celulaCabecalho}>Trecho</Text>}
                  <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Item</Text>
                  <Text style={estilos.celulaCabecalho}>Quantidade</Text>
                </View>
                {quadroMateriais.map((linha, i) => (
                  <View key={i} style={estilos.linha}>
                    {itens.length > 1 && <Text style={estilos.celula}>{linha.trechoNumero}</Text>}
                    <Text style={{ ...estilos.celula, flex: 2 }}>{linha.titulo}</Text>
                    <Text style={estilos.celula}>
                      {formatarNumero(linha.quantidade, linha.unidade === "g" ? 1 : 2)} {linha.unidade}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={{ ...estilos.blocoTitulo, marginTop: !somenteMaoObra && quadroMateriais.length > 0 ? 10 : 0 }}>
            Mão de obra e custos operacionais
          </Text>
          {quadroOperacional.map((label) => (
            <Text key={label} style={estilos.listaItem}>
              • {label}: <Text style={{ fontFamily: "Helvetica-Bold" }}>Incluso</Text>
            </Text>
          ))}
        </View>

        {temTopicoRoi && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>{n++}. ROI e Projeção Econômica</Text>
            <Text style={{ ...estilos.paragrafo, fontSize: 9, marginBottom: 6, fontStyle: "italic" }}>{NOTA_ESTIMATIVA_COMPARATIVA}</Text>

            {!somenteMaoObra && paybackMeses != null && (
              <View style={estilos.caixaRoi} wrap={false}>
                <Text style={estilos.roiTitulo}>Retorno do Investimento</Text>
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
                <Text style={estilos.notaRodape}>Material já fornecido pelo cliente — o investimento aqui é só a mão de obra.</Text>
              </View>
            )}

            {projecaoDezAnos.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={estilos.blocoTitulo}>Projeção de economia acumulada (10 anos)</Text>
                <Text style={{ ...estilos.paragrafo, fontSize: 9, marginBottom: 6 }}>
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
          </View>
        )}

        {(economiaAnualTotal > 0 || co2ToneladasAno > 0) && (
          <View style={{ ...estilos.blocoDestaque, marginTop: 4 }} wrap={false}>
            <Text style={estilos.secaoTitulo}>{n++}. Benefícios Ambientais</Text>
            <Text style={{ ...estilos.paragrafo, fontSize: 9, marginBottom: 4, fontStyle: "italic" }}>{NOTA_ESTIMATIVA_COMPARATIVA}</Text>
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
              Equivalência de árvores é uma estimativa ilustrativa (fator configurável), não uma métrica de
              compensação de carbono certificada.
            </Text>
          </View>
        )}

        <View style={estilos.totalCaixa} wrap={false}>
          <Text style={estilos.secaoTitulo}>{n++}. Resumo Financeiro</Text>
          {!somenteMaoObra && <Linha label="Material" valor={formatarMoeda(resumoSimplificado.material)} />}
          <Linha label="Mão de Obra" valor={formatarMoeda(resumoSimplificado.maoDeObra)} />
          <View style={estilos.totalLinha}>
            <Text style={estilos.totalLabel}>Valor Total</Text>
            <Text style={estilos.totalValor}>{formatarMoeda(orcamento.valor_final)}</Text>
          </View>
        </View>

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>{n++}. Condições Comerciais</Text>

          <Text style={estilos.blocoTitulo}>Forma de pagamento</Text>
          <Text style={estilos.listaItem}>• À vista: {formatarNumero(descontoAvista, 0)}% de desconto</Text>
          <Text style={estilos.listaItem}>• {formaPagamentoPadrao}</Text>
          <Text style={estilos.listaItem}>• Parcelado: consulte condições</Text>

          <Text style={{ ...estilos.blocoTitulo, marginTop: 10 }}>Prazo de execução e validade</Text>
          <Text style={estilos.paragrafo}>
            {prazoDias != null
              ? `${prazoDias} dia(s) útil(eis), estimado(s) a partir da mão de obra calculada para esta proposta.`
              : "A confirmar após aceite."}{" "}
            Data de início a combinar com o cliente. Proposta válida por {validadeDias} dias a partir da emissão.
          </Text>

          <Text style={{ ...estilos.blocoTitulo, marginTop: 10 }}>Garantias</Text>
          <Text style={estilos.listaItem}>• Mão de obra: {garantiaMeses} meses</Text>
          <Text style={estilos.listaItem}>• Materiais: conforme garantia do fabricante</Text>

          {/* Empilhado (não em duas colunas) — pedido explícito. */}
          <Text style={{ ...estilos.blocoTitulo, marginTop: 10 }}>Responsabilidades — BR Isolamentos</Text>
          <Text style={estilos.listaItem}>• Execução conforme especificações técnicas desta proposta</Text>
          <Text style={estilos.listaItem}>• Equipe especializada e qualificada</Text>
          {!somenteMaoObra && <Text style={estilos.listaItem}>• Materiais conforme escopo aprovado</Text>}
          <Text style={estilos.listaItem}>• Garantia de mão de obra ({garantiaMeses} meses)</Text>
          <Text style={estilos.listaItem}>• EPI da própria equipe</Text>
          <Text style={estilos.listaItem}>• Limpeza da área de trabalho após a execução</Text>
          <Text style={estilos.listaItem}>• Cumprimento das normas de segurança aplicáveis (NRs)</Text>

          <Text style={{ ...estilos.blocoTitulo, marginTop: 10 }}>Responsabilidades — Cliente</Text>
          <Text style={estilos.listaItem}>• Acesso seguro ao local de trabalho</Text>
          <Text style={estilos.listaItem}>• Liberação de segurança conforme protocolos internos</Text>
          <Text style={estilos.listaItem}>• Energia e água disponíveis quando necessário</Text>
          <Text style={estilos.listaItem}>• Área para estocagem de materiais, quando aplicável</Text>
          <Text style={estilos.listaItem}>• Estrutura de apoio para trabalho em altura, quando aplicável</Text>
          <Text style={estilos.listaItem}>• Comunicação de mudanças de cronograma com antecedência</Text>
          <Text style={estilos.listaItem}>• Coordenação de paradas de equipamento, quando necessário</Text>
        </View>

        {orcamento.observacoes_adicionais && (
          <View style={estilos.secao} wrap={false}>
            <Text style={estilos.secaoTitulo}>Observações Adicionais</Text>
            <Text style={estilos.paragrafo}>{orcamento.observacoes_adicionais}</Text>
          </View>
        )}

        <View style={estilos.secao} wrap={false}>
          <Text style={estilos.secaoTitulo}>{n++}. Próximos Passos</Text>
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

        {imagens.length > 0 && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Nossa Experiência</Text>
            <View style={estilos.imagensLinha}>
              {imagens.map((imagem, index) => (
                <View key={index} style={{ width: "48%", marginBottom: 8 }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={imagem.url} style={estilos.imagem} />
                  {imagem.legenda && <Text style={estilos.legenda}>{imagem.legenda}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        <Rodape configEmpresa={configEmpresa} validadeDias={validadeDias} />
        <Text style={estilos.paginaNumero} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
