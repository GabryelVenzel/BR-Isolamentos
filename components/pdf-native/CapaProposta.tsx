// Página de capa (pedido "REFATORAÇÃO PROPOSTAS TÉCNICA E COMERCIAL") —
// primeira <Page> do Document, full-bleed na cor da marca. Usa o logo real
// já cadastrado em /public/logo.png (fundo navy já embutido na própria
// imagem — bate com CORES.brand, por isso a página inteira usa a mesma cor
// de fundo em vez de branco). Nenhuma foto de referência aqui: a galeria
// "Referências de obras executadas" já existente na Proposta Técnica cobre
// esse papel — duplicar reduziria o efeito em vez de reforçar.

import { Page, Text, View, Image } from "@react-pdf/renderer";
import { formatarData } from "@/lib/format";
import { estilos } from "./estilos";
import type { Orcamento } from "@/lib/types";

interface Props {
  tipo: "tecnica" | "comercial";
  orcamento: Orcamento;
}

export default function CapaProposta({ tipo, orcamento }: Props) {
  const local = [orcamento.cliente?.cidade, orcamento.cliente?.estado].filter(Boolean).join(" - ");

  return (
    <Page size="A4" style={estilos.paginaCapa}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src="/logo.png" style={estilos.capaLogo} />

      <Text style={estilos.capaTitulo}>Proposta {tipo === "tecnica" ? "Técnica" : "Comercial"}</Text>
      <Text style={estilos.capaSubtitulo}>Isolamento Térmico Industrial</Text>

      <View style={estilos.capaInfoBloco}>
        {orcamento.cliente?.nome && <Text style={estilos.capaInfoDestaque}>{orcamento.cliente.nome}</Text>}
        {local && <Text style={estilos.capaInfoLinha}>{local}</Text>}
        <Text style={estilos.capaInfoLinha}>
          Nº {orcamento.numero} · {formatarData(orcamento.data_criacao)}
        </Text>
      </View>

      <Text style={estilos.capaRodape}>BR Isolamentos — Soluções em Isolamentos Térmicos · Mogi das Cruzes, SP</Text>
    </Page>
  );
}
