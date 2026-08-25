// Versão NATIVA (vetorial) da Proposta Comercial — ver comentário no topo de
// PropostaTecnicaDocument.tsx pra decisão geral. Mesmas seções de
// components/PDFPreviewComercial.tsx (mantido só pro preview em tela).

import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import { estilos } from "./estilos";
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

  const temCustosOperacionais =
    orcamento.valor_mao_obra > 0 || orcamento.valor_deslocamento > 0 || orcamento.valor_hospedagem > 0 || orcamento.valor_frete > 0;

  const beneficios = itens.filter((i) => i.economia_anual != null || i.co2_ton_ano != null);
  const economiaAnualTotal = beneficios.reduce((acc, i) => acc + (i.economia_anual ?? 0), 0);
  const co2TotalAno = beneficios.reduce((acc, i) => acc + (i.co2_ton_ano ?? 0), 0);

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

        {!ehLegado && itens.length > 0 && (
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

        {beneficios.length > 0 && (
          <View style={{ ...estilos.blocoDestaque, marginTop: 14 }} wrap={false}>
            <Text style={estilos.secaoTitulo}>Benefícios da Solução</Text>
            {economiaAnualTotal > 0 && (
              <Text style={estilos.listaItem}>• Economia anual estimada de energia: {formatarMoeda(economiaAnualTotal)}</Text>
            )}
            {co2TotalAno > 0 && <Text style={estilos.listaItem}>• Redução de emissão de CO₂: {formatarNumero(co2TotalAno, 2)} toneladas/ano</Text>}
          </View>
        )}

        <Rodape configEmpresa={configEmpresa} />
        <Text style={estilos.paginaNumero} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
