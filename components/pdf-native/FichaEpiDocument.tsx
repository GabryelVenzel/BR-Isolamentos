// Ficha de controle de entrega de EPI (NR-6, item 6.6.1, "h": registrar o
// fornecimento ao trabalhador) — gerada no navegador com @react-pdf/renderer,
// mesmo padrão das Propostas. Uma linha por entrega, com espaço para a
// assinatura do funcionário, e a declaração de recebimento no fim.

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatarData, formatarNumero } from "@/lib/format";
import type { Funcionario, FuncionarioEpi } from "@/lib/types/domain";
import { CORES } from "./estilos";

const e = StyleSheet.create({
  pagina: { paddingTop: "15mm", paddingBottom: "18mm", paddingHorizontal: "14mm", fontSize: 9.5, fontFamily: "Helvetica", color: CORES.cinza },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: CORES.brand, paddingBottom: 6, marginBottom: 10 },
  empresa: { fontSize: 13, fontFamily: "Helvetica-Bold", color: CORES.brand },
  titulo: { fontSize: 12, fontFamily: "Helvetica-Bold", color: CORES.brand, textAlign: "right" },
  sub: { fontSize: 8.5, color: CORES.cinzaClaro },
  bloco: { borderWidth: 1, borderColor: CORES.cinzaMuitoClaro, padding: 8, marginBottom: 10 },
  linhaDados: { flexDirection: "row", marginBottom: 3 },
  rotulo: { width: 70, fontFamily: "Helvetica-Bold" },
  tabela: { borderWidth: 1, borderColor: CORES.cinzaMuitoClaro },
  cab: { flexDirection: "row", backgroundColor: CORES.brandLight },
  linha: { flexDirection: "row", borderTopWidth: 1, borderTopColor: CORES.cinzaMuitoClaro, minHeight: 24, alignItems: "center" },
  celula: { paddingHorizontal: 4, paddingVertical: 3 },
  celulaCab: { paddingHorizontal: 4, paddingVertical: 4, fontFamily: "Helvetica-Bold", color: CORES.brand, fontSize: 8.5 },
  declaracao: { marginTop: 12, fontSize: 8.5, lineHeight: 1.4, textAlign: "justify" },
  assinaturas: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  assinatura: { width: "45%", borderTopWidth: 1, borderTopColor: CORES.cinza, paddingTop: 3, textAlign: "center", fontSize: 8.5 },
  rodape: { position: "absolute", bottom: "8mm", left: "14mm", right: "14mm", fontSize: 7.5, color: CORES.cinzaClaro, textAlign: "center" },
});

// Larguras das colunas (somam 100%).
const COL = { data: "11%", item: "31%", ca: "11%", qtd: "7%", devolucao: "12%", assinatura: "28%" } as const;

interface Props {
  empresa: { nome: string; cnpj: string | null };
  funcionario: Pick<Funcionario, "nome" | "cpf" | "cargo" | "data_admissao" | "numero_funcionario">;
  entregas: FuncionarioEpi[];
}

export default function FichaEpiDocument({ empresa, funcionario, entregas }: Props) {
  const ordenadas = [...entregas].sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
  // Linhas em branco no fim, para as próximas entregas serem anotadas à mão.
  const vazias = Math.max(3, 14 - ordenadas.length);

  return (
    <Document title={`Ficha de EPI — ${funcionario.nome}`}>
      <Page size="A4" style={e.pagina}>
        <View style={e.topo}>
          <View>
            <Text style={e.empresa}>{empresa.nome}</Text>
            {empresa.cnpj && <Text style={e.sub}>CNPJ {empresa.cnpj}</Text>}
          </View>
          <View>
            <Text style={e.titulo}>Ficha de Controle de Entrega de EPI</Text>
            <Text style={[e.sub, { textAlign: "right" }]}>NR-6 — Equipamento de Proteção Individual</Text>
          </View>
        </View>

        <View style={e.bloco}>
          <View style={e.linhaDados}>
            <Text style={e.rotulo}>Funcionário:</Text>
            <Text>
              {funcionario.nome}
              {funcionario.numero_funcionario ? ` (${funcionario.numero_funcionario})` : ""}
            </Text>
          </View>
          <View style={e.linhaDados}>
            <Text style={e.rotulo}>CPF:</Text>
            <Text style={{ width: 150 }}>{funcionario.cpf ?? "—"}</Text>
            <Text style={e.rotulo}>Função:</Text>
            <Text>{funcionario.cargo ?? "—"}</Text>
          </View>
          <View style={e.linhaDados}>
            <Text style={e.rotulo}>Admissão:</Text>
            <Text>{funcionario.data_admissao ? formatarData(funcionario.data_admissao) : "—"}</Text>
          </View>
        </View>

        <View style={e.tabela}>
          <View style={e.cab} fixed>
            <Text style={[e.celulaCab, { width: COL.data }]}>Entrega</Text>
            <Text style={[e.celulaCab, { width: COL.item }]}>EPI</Text>
            <Text style={[e.celulaCab, { width: COL.ca }]}>CA</Text>
            <Text style={[e.celulaCab, { width: COL.qtd }]}>Qtd.</Text>
            <Text style={[e.celulaCab, { width: COL.devolucao }]}>Devolução</Text>
            <Text style={[e.celulaCab, { width: COL.assinatura }]}>Assinatura do funcionário</Text>
          </View>
          {ordenadas.map((epi) => (
            <View key={epi.id} style={e.linha} wrap={false}>
              <Text style={[e.celula, { width: COL.data }]}>{formatarData(epi.data_entrega)}</Text>
              <Text style={[e.celula, { width: COL.item }]}>{epi.item}</Text>
              <Text style={[e.celula, { width: COL.ca }]}>{epi.ca ?? "—"}</Text>
              <Text style={[e.celula, { width: COL.qtd }]}>{formatarNumero(epi.quantidade, Number.isInteger(epi.quantidade) ? 0 : 2)}</Text>
              <Text style={[e.celula, { width: COL.devolucao }]}>{epi.data_devolucao ? formatarData(epi.data_devolucao) : ""}</Text>
              <Text style={[e.celula, { width: COL.assinatura }]} />
            </View>
          ))}
          {Array.from({ length: vazias }).map((_, i) => (
            <View key={`vazia-${i}`} style={e.linha} wrap={false}>
              {Object.values(COL).map((largura, c) => (
                <Text key={c} style={[e.celula, { width: largura }]} />
              ))}
            </View>
          ))}
        </View>

        <Text style={e.declaracao}>
          Declaro ter recebido gratuitamente os Equipamentos de Proteção Individual acima relacionados, em perfeito estado, e ter sido
          orientado e treinado sobre o seu uso adequado, guarda e conservação. Comprometo-me a usá-los apenas para a finalidade a que se
          destinam, responsabilizar-me pela sua guarda e conservação, comunicar qualquer alteração que os torne impróprios para uso e
          devolvê-los quando solicitado ou no desligamento, ciente de que a recusa injustificada ao uso do EPI constitui ato faltoso (NR-6 e
          art. 158 da CLT).
        </Text>

        <View style={e.assinaturas}>
          <Text style={e.assinatura}>{funcionario.nome}</Text>
          <Text style={e.assinatura}>{empresa.nome} — responsável pela entrega</Text>
        </View>

        <Text style={e.rodape} fixed render={({ pageNumber, totalPages }) => `Ficha de EPI · ${funcionario.nome} · página ${pageNumber} de ${totalPages}`} />
      </Page>
    </Document>
  );
}
