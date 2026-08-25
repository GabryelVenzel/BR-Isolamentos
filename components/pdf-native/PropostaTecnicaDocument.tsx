// Versão NATIVA (vetorial, texto selecionável) da Proposta Técnica —
// substitui a captura de tela (html2canvas) de components/PDFPreviewTecnica.tsx
// pelo motor de desenho de PDF de verdade do @react-pdf/renderer. Mesmo
// conteúdo/seções do componente antigo (mantido só para o preview em tela —
// ver comentário no topo de app/orcamento/[id]/download-pdf/page.tsx),
// remontado com os primitivos próprios do react-pdf (Document/Page/View/
// Text), que já paginam corretamente em A4 sem nenhuma lógica de corte
// manual — cada <Page> é uma folha real, o conteúdo que não cabe flui pra
// próxima página sozinho.

import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { formatarData, formatarMoeda, formatarNumero } from "@/lib/format";
import { estilos } from "./estilos";
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

function Cabecalho({ orcamento }: { orcamento: Orcamento }) {
  return (
    <View fixed>
      <View style={estilos.cabecalhoLinha}>
        <View>
          <Text style={estilos.marca}>BR ISOLAMENTOS</Text>
          <Text style={estilos.titulo}>PROPOSTA TÉCNICA</Text>
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
        Proposta técnica sem valores comerciais — consulte a Proposta Comercial para o investimento. Orçamento válido
        por 30 dias. Cálculos conforme normas ASTM C680, ISO 12241 e ABNT NBR 16281.
      </Text>
    </View>
  );
}

export default function PropostaTecnicaDocument({ orcamento, imagens = [], configEmpresa }: Props) {
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const itensQuentes = itens.filter((i) => i.tipo_trabalho === "quente");
  const itensFrios = itens.filter((i) => i.tipo_trabalho === "frio");
  const temQuente = itensQuentes.length > 0;
  const temFrio = itensFrios.length > 0;

  let numeroSecao = 2; // 1. já é "Por que isolar termicamente"

  return (
    <Document title={`Proposta Técnica ${orcamento.numero}`}>
      <Page size="A4" style={estilos.pagina} wrap>
        <Cabecalho orcamento={orcamento} />

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>1. Por que isolar termicamente</Text>
          <Text style={estilos.paragrafo}>
            O isolamento térmico fixo reduz a troca de calor entre uma superfície (tubulação, equipamento ou
            envoltória) e o ambiente, trazendo ganhos diretos em quatro frentes: eficiência energética (menos
            combustível ou energia elétrica para manter a temperatura de processo), segurança (redução da
            temperatura de superfícies acessíveis, evitando queimaduras), controle de processo (temperaturas mais
            estáveis) e, em sistemas frios, prevenção de condensação e da corrosão e proliferação de mofo que ela
            causa ao longo do tempo.
          </Text>
        </View>

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>{numeroSecao++}. Princípios físicos aplicados</Text>
          <Text style={estilos.paragrafo}>
            O dimensionamento de cada trecho considera os três mecanismos de transferência de calor atuando em
            série: condução através da espessura do isolante (regida pela condutividade térmica k do material, que
            varia com a temperatura), e convecção (natural ou forçada pelo vento) somada à radiação na face externa,
            trocando calor com o ambiente. O ponto de equilíbrio entre esses mecanismos — a temperatura da face fria
            do isolamento — é encontrado por método iterativo, seguindo as práticas recomendadas pelas normas ASTM
            C680 e ISO 12241, em conformidade com a ABNT NBR 16281.
          </Text>
        </View>

        {temQuente && (
          <View style={estilos.secao} wrap={false}>
            <Text style={estilos.secaoTitulo}>{numeroSecao++}. Eficiência energética e redução de carbono</Text>
            <Text style={{ ...estilos.paragrafo, marginBottom: 6 }}>
              Em sistemas quentes, cada grau de temperatura perdido pela superfície para o ambiente representa
              energia comprada e não aproveitada no processo. Isolar reduz essa perda, o que se traduz em menor
              consumo de combustível ou eletricidade, menor custo operacional recorrente e menor emissão de CO₂
              associada à queima desse combustível.
            </Text>
            {itensQuentes.map((item) => (
              <View key={item.id} style={estilos.blocoDestaque}>
                <Text style={estilos.blocoTitulo}>
                  {item.material}
                  {item.acabamento ? ` · ${item.acabamento}` : ""}
                </Text>
                <Text style={estilos.paragrafo}>Perda de calor sem isolante: {formatarNumero(item.perda_sem_isolante, 3)} kW/m²</Text>
                <Text style={estilos.paragrafo}>Perda de calor com isolante: {formatarNumero(item.perda_com_isolante, 3)} kW/m²</Text>
                {item.economia_anual != null && (
                  <Text style={estilos.paragrafo}>Economia anual estimada: {formatarMoeda(item.economia_anual)}</Text>
                )}
                {item.co2_ton_ano != null && (
                  <Text style={estilos.paragrafo}>CO₂ evitado por ano: {formatarNumero(item.co2_ton_ano, 2)} toneladas</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {temFrio && (
          <View style={estilos.secao} wrap={false}>
            <Text style={estilos.secaoTitulo}>{numeroSecao++}. Prevenção de condensação</Text>
            <Text style={{ ...estilos.paragrafo, marginBottom: 6 }}>
              Em sistemas frios, quando a temperatura da superfície isolada fica abaixo do ponto de orvalho do ar
              ambiente, o vapor de água presente no ar condensa sobre ela — causando corrosão sob isolamento,
              formação de mofo e gotejamento. A espessura mínima de cada trecho é calculada (fórmula de Magnus para
              o ponto de orvalho, combinada com o mesmo método iterativo de equilíbrio térmico) para manter a face
              fria do isolamento sempre acima dessa temperatura crítica.
            </Text>
            {itensFrios.map((item) => (
              <View key={item.id} style={estilos.blocoDestaqueFrio}>
                <Text style={estilos.blocoTitulo}>{item.material}</Text>
                <Text style={estilos.paragrafo}>Espessura mínima recomendada: {formatarNumero(item.espessura_necessaria_mm, 1)} mm</Text>
              </View>
            ))}
          </View>
        )}

        <View style={estilos.secao}>
          <Text style={estilos.secaoTitulo}>{numeroSecao++}. Escopo contemplado</Text>
          {itens.map((item, index) => (
            <View key={item.id} style={{ marginBottom: 4 }}>
              <Text style={estilos.blocoTitulo}>
                Trecho {index + 1} ({LABEL_TIPO[item.tipo_trabalho]})
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
        </View>

        <View style={estilos.secao} wrap={false}>
          <Text style={estilos.secaoTitulo}>{numeroSecao++}. Especificação técnica por trecho</Text>
          <View style={estilos.tabela}>
            <View style={estilos.linhaCabecalho}>
              <Text style={estilos.celulaCabecalho}>Trecho</Text>
              <Text style={{ ...estilos.celulaCabecalho, flex: 2 }}>Material</Text>
              <Text style={estilos.celulaCabecalho}>Geometria</Text>
              <Text style={estilos.celulaCabecalho}>Área</Text>
              <Text style={estilos.celulaCabecalho}>Espessura</Text>
            </View>
            {itens.map((item, index) => (
              <View key={item.id} style={estilos.linha}>
                <Text style={estilos.celula}>
                  {index + 1} ({LABEL_TIPO[item.tipo_trabalho]})
                </Text>
                <Text style={{ ...estilos.celula, flex: 2 }}>{item.material}</Text>
                <Text style={estilos.celula}>{item.geometria === "tubulacao" ? "Tubulação" : "Sup. plana"}</Text>
                <Text style={estilos.celula}>{formatarNumero(item.area_m2)} m²</Text>
                <Text style={estilos.celula}>{formatarNumero(item.espessura_necessaria_mm, 1)} mm</Text>
              </View>
            ))}
          </View>
        </View>

        {imagens.length > 0 && (
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Referências de obras executadas</Text>
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

        <Rodape configEmpresa={configEmpresa} />
        <Text
          style={estilos.paginaNumero}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
