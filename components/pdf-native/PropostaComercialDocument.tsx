// Versão NATIVA (vetorial) da Proposta Comercial — ver comentário no topo de
// PropostaTecnicaDocument.tsx pra decisão geral. Mesmas seções de
// components/PDFPreviewComercial.tsx (mantido só pro preview em tela).
//
// Estrutura elaborada (pedidos "PROPOSTAS TÉCNICA E COMERCIAL ELABORADAS",
// "PROPOSTAS DIFERENCIADAS POR TIPO" e "REFATORAÇÃO PROPOSTAS TÉCNICA E
// COMERCIAL") — DECISÃO DE ARQUITETURA: os pedidos descrevem "6 variações"
// de proposta (Material+MO/Somente MO × Quente/Frio/Mista). Em vez de 6
// templates hardcoded (muita duplicação de texto, alto risco de divergência
// entre eles), este documento é UM template que se adapta aos dados reais do
// orçamento — filtra itens por `tipo_trabalho` e ramifica texto/seções por
// `orcamento.tipo_proposta`. Uma proposta "mista" já sai com as duas seções
// (quente e frio) automaticamente, sem template dedicado.
//
// Os números de política comercial citados nos pedidos (desconto à vista,
// garantia, reajuste tarifário assumido na projeção de 10 anos, fator de
// CO₂/árvore, validade, forma de pagamento) vêm de `configEmpresa`
// (migrações 020/021), nunca hardcoded.
//
// REVISÃO NESTA RODADA ("REFATORAÇÃO..."): a tabela de quantificação
// perdeu as colunas de preço unitário/subtotal por material (mostra só
// item + quantidade) e o Resumo Financeiro parou de listar cada imposto
// por nome/percentual — agora soma tudo numa linha "Impostos & Encargos"
// e uma "Margem Operacional", sem percentuais. Pedido explícito: "cliente
// vê apenas os valores, não os percentuais de impostos ou margem". Isso
// substitui o comportamento da rodada anterior (tabela detalhada com preço
// unitário por material, impostos itemizados por nome) — ver histórico do
// commit anterior se precisar recuperar aquele nível de detalhe.

import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import {
  arvoresEquivalentes,
  calcularBeneficiosConsolidados,
  calcularPaybackDias,
  calcularPaybackMeses,
  itensNaoContemplados,
  prazoExecucaoDiasUteis,
  projetarEconomiaAcumulada,
  temAnaliseFinanceira,
} from "@/lib/usecases/orcamento";
import { estilos } from "./estilos";
import CapaProposta from "./CapaProposta";
import type { ConfigEmpresa, Orcamento } from "@/lib/types";

interface Props {
  orcamento: Orcamento;
  configEmpresa?: ConfigEmpresa | null;
}

const LABEL_TIPO: Record<string, string> = { quente: "Quente", frio: "Frio", misto: "Misto (quente + frio)" };
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
          <Text style={estilos.cabecalhoTexto}>{LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}</Text>
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

export default function PropostaComercialDocument({ orcamento, configEmpresa }: Props) {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const ehLegado = itens.length > 0 && itens[0].manta_kg != null;
  const somenteMaoObra = orcamento.tipo_proposta === "somente_mo";

  const { economiaAnualTotal, co2ToneladasAno } = calcularBeneficiosConsolidados(itens);

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
  const validadeDias = configEmpresa?.validade_proposta_dias ?? 30;
  const formaPagamentoPadrao = configEmpresa?.forma_pagamento_padrao || "50% de entrada + 50% na conclusão dos trabalhos";
  const naoContempla = itensNaoContemplados(orcamento.tipo_proposta);

  let n = 1; // numeração dos tópicos principais (pedido explícito: "Títulos Numerados em Tópicos")

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
            Escopo: {LABEL_PROPOSTA[orcamento.tipo_proposta] ?? orcamento.tipo_proposta} · {LABEL_TIPO[orcamento.tipo_trabalho] ?? orcamento.tipo_trabalho}
          </Text>
        </View>

        <View style={estilos.secao} wrap={false}>
          <Text style={estilos.secaoTitulo}>{n++}. Especificações Técnicas</Text>
          <View style={estilos.tabela}>
            <View style={estilos.linhaCabecalho}>
              <Text style={estilos.celulaCabecalho}>Trecho</Text>
              <Text style={{ ...estilos.celulaCabecalho, flex: 3 }}>Material</Text>
              <Text style={estilos.celulaCabecalho}>Tipo</Text>
              <Text style={estilos.celulaCabecalho}>Área</Text>
            </View>
            {itens.map((item, index) => (
              <View key={item.id} style={estilos.linha}>
                <Text style={estilos.celula}>{index + 1}</Text>
                <Text style={{ ...estilos.celula, flex: 3 }}>
                  {item.material}
                  {item.acabamento ? ` · ${item.acabamento}` : ""}
                </Text>
                <Text style={estilos.celula}>{LABEL_TIPO[item.tipo_trabalho] ?? item.tipo_trabalho}</Text>
                <Text style={estilos.celula}>{formatarNumero(item.area_m2)} m²</Text>
              </View>
            ))}
          </View>
        </View>

        {(() => {
          const numeroQuantificacao = n++;
          return somenteMaoObra ? (
            <View style={estilos.secao} wrap={false}>
              <Text style={estilos.secaoTitulo}>{numeroQuantificacao}. Quantificação de Mão de Obra</Text>
              <Text style={{ ...estilos.paragrafo, fontSize: 9, marginBottom: 6 }}>
                Proposta "Somente Mão de Obra" — o material é fornecido pelo cliente e não entra neste investimento.
              </Text>
              <View style={estilos.tabela}>
                <View style={estilos.linhaCabecalho}>
                  <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Trecho</Text>
                  <Text style={estilos.celulaCabecalho}>Horas</Text>
                </View>
                {itens.map((item, index) => (
                  <View key={item.id} style={estilos.linha}>
                    <Text style={{ ...estilos.celula, flex: 2 }}>
                      Trecho {index + 1} ({LABEL_TIPO[item.tipo_trabalho]})
                    </Text>
                    <Text style={estilos.celula}>{formatarNumero(item.horas_mao_obra ?? 0, 1)} h</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : temDetalhamentoNovo ? (
            <View style={estilos.secao}>
              <Text style={estilos.secaoTitulo}>{numeroQuantificacao}. Quantificação de Materiais e Mão de Obra</Text>
              {itens.map((item, index) => {
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
                        <Text style={{ ...estilos.celulaCabecalho, flex: 3 }}>Item</Text>
                        <Text style={estilos.celulaCabecalho}>Quantidade</Text>
                      </View>
                      {item.detalhamento_materiais.map((linha, i) => (
                        <View key={i} style={estilos.linha}>
                          <Text style={{ ...estilos.celula, flex: 3 }}>{linha.titulo}</Text>
                          <Text style={estilos.celula}>
                            {formatarNumero(linha.quantidade, linha.unidade === "g" ? 1 : 2)} {linha.unidade}
                          </Text>
                        </View>
                      ))}
                      {item.horas_mao_obra > 0 && (
                        <View style={estilos.linha}>
                          <Text style={{ ...estilos.celula, flex: 3 }}>Mão de obra (dupla)</Text>
                          <Text style={estilos.celula}>{formatarNumero(item.horas_mao_obra, 1)} h</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            !ehLegado &&
            itens.length > 0 && (
              <View style={estilos.secao} wrap={false}>
                <Text style={estilos.secaoTitulo}>{numeroQuantificacao}. Materiais por Trecho</Text>
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
              </View>
            )
          );
        })()}

        <View style={estilos.totalCaixa} wrap={false}>
          <Text style={estilos.secaoTitulo}>{n++}. Resumo Financeiro</Text>
          {!somenteMaoObra && <Linha label="Materiais" valor={formatarMoeda(orcamento.valor_materiais)} />}
          <Linha label="Mão de Obra" valor={formatarMoeda(orcamento.valor_mao_obra)} />
          {orcamento.valor_deslocamento > 0 && <Linha label="Deslocamento" valor={formatarMoeda(orcamento.valor_deslocamento)} />}
          {orcamento.valor_hospedagem > 0 && <Linha label="Hospedagem" valor={formatarMoeda(orcamento.valor_hospedagem)} />}
          {orcamento.valor_frete > 0 && <Linha label="Frete" valor={formatarMoeda(orcamento.valor_frete)} />}
          <Linha label="Subtotal" valor={formatarMoeda(orcamento.subtotal)} destaque />
          <Linha label="Impostos & Encargos" valor={formatarMoeda(orcamento.total_impostos)} />
          <Linha label="Margem Operacional" valor={formatarMoeda(orcamento.margem_lucro)} />
          {orcamento.valor_desconto > 0 && <Linha label="Desconto comercial" valor={`- ${formatarMoeda(orcamento.valor_desconto)}`} />}
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
            <Text style={estilos.secaoTitulo}>{n++}. Projeção de Economia Acumulada (10 anos)</Text>
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

        {(economiaAnualTotal > 0 || co2ToneladasAno > 0) && (
          <View style={{ ...estilos.blocoDestaque, marginTop: 4 }} wrap={false}>
            <Text style={estilos.secaoTitulo}>{n++}. Benefícios Ambientais</Text>
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

          <Text style={{ ...estilos.blocoTitulo, marginTop: 10 }}>Responsabilidades</Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 2 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...estilos.blocoTitulo, fontSize: 9.5 }}>BR Isolamentos</Text>
              <Text style={estilos.listaItem}>• Execução conforme especificações técnicas desta proposta</Text>
              <Text style={estilos.listaItem}>• Equipe especializada e qualificada</Text>
              {!somenteMaoObra && <Text style={estilos.listaItem}>• Materiais conforme escopo aprovado</Text>}
              <Text style={estilos.listaItem}>• Garantia de mão de obra ({garantiaMeses} meses)</Text>
              <Text style={estilos.listaItem}>• EPI da própria equipe</Text>
              <Text style={estilos.listaItem}>• Limpeza da área de trabalho após a execução</Text>
              <Text style={estilos.listaItem}>• Cumprimento das normas de segurança aplicáveis (NRs)</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...estilos.blocoTitulo, fontSize: 9.5 }}>Cliente</Text>
              <Text style={estilos.listaItem}>• Acesso seguro ao local de trabalho</Text>
              <Text style={estilos.listaItem}>• Liberação de segurança conforme protocolos internos</Text>
              <Text style={estilos.listaItem}>• Energia e água disponíveis quando necessário</Text>
              <Text style={estilos.listaItem}>• Área para estocagem de materiais, quando aplicável</Text>
              <Text style={estilos.listaItem}>• Estrutura de apoio para trabalho em altura, quando aplicável</Text>
              <Text style={estilos.listaItem}>• Comunicação de mudanças de cronograma com antecedência</Text>
              <Text style={estilos.listaItem}>• Coordenação de paradas de equipamento, quando necessário</Text>
            </View>
          </View>

          <Text style={{ ...estilos.blocoTitulo, marginTop: 10 }}>Não contemplado nesta proposta</Text>
          <Text style={estilos.listaItem}>• Modificações de escopo não descritas nesta proposta</Text>
          {naoContempla.map((texto) => (
            <Text key={texto} style={estilos.listaItem}>
              • {texto}
            </Text>
          ))}
        </View>

        {orcamento.observacoes_adicionais && (
          <View style={estilos.secao} wrap={false}>
            <Text style={estilos.secaoTitulo}>{n++}. Observações Adicionais</Text>
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

        <Rodape configEmpresa={configEmpresa} validadeDias={validadeDias} />
        <Text style={estilos.paginaNumero} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
