// Estilos compartilhados entre PropostaTecnicaDocument e
// PropostaComercialDocument — StyleSheet do @react-pdf/renderer (API própria,
// parecida com React Native: flexbox, sem CSS grid, sem className). Fontes:
// só Helvetica (nativa do PDF, sempre disponível sem precisar registrar/
// carregar arquivo de fonte nenhum — "Alfaim 2"/Montserrat, as fontes da
// marca, exigiriam Font.register() com um arquivo .ttf/.woff que não temos
// aqui; um registro de fonte que falhar silenciosamente quebraria a geração
// do PDF inteiro, risco maior do que vale a pena só pra bater a fonte exata).

import { StyleSheet } from "@react-pdf/renderer";

export const CORES = {
  brand: "#060035",
  brandLight: "#E4E1F0",
  accent: "#078B41",
  accentLight: "#DCF3E3",
  secondary: "#FBC819",
  secondaryLight: "#FEF3D1",
  erro: "#DC3545",
  cinza: "#333333",
  cinzaClaro: "#6B7280",
  cinzaMuitoClaro: "#E5E7EB",
  branco: "#FFFFFF",
};

export const estilos = StyleSheet.create({
  pagina: {
    padding: "18mm 15mm",
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: CORES.cinza,
  },
  cabecalhoLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  marca: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: CORES.brand,
  },
  titulo: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: CORES.brand,
    marginTop: 4,
  },
  cabecalhoDireita: {
    alignItems: "flex-end",
  },
  cabecalhoTexto: {
    fontSize: 9,
    color: CORES.cinzaClaro,
  },
  cabecalhoNumero: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: CORES.brand,
  },
  divisorMarca: {
    height: 2,
    backgroundColor: CORES.accent,
    marginTop: 6,
    marginBottom: 14,
  },
  secao: {
    marginBottom: 14,
  },
  secaoTitulo: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: CORES.brand,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  paragrafo: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: CORES.cinza,
  },
  caixaCliente: {
    backgroundColor: CORES.brandLight,
    borderRadius: 4,
    padding: 10,
    marginBottom: 14,
  },
  caixaClienteNome: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: CORES.cinza,
  },
  caixaClienteLinha: {
    fontSize: 9,
    color: CORES.cinzaClaro,
    marginTop: 2,
  },
  blocoDestaque: {
    borderLeftWidth: 3,
    borderLeftColor: CORES.accent,
    backgroundColor: CORES.accentLight,
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  blocoDestaqueFrio: {
    borderLeftWidth: 3,
    borderLeftColor: CORES.brand,
    backgroundColor: CORES.brandLight,
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  blocoTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: CORES.brand,
    marginBottom: 2,
  },
  tabela: {
    borderWidth: 1,
    borderColor: CORES.cinzaMuitoClaro,
    borderRadius: 3,
  },
  linhaCabecalho: {
    flexDirection: "row",
    backgroundColor: CORES.brandLight,
  },
  linha: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: CORES.cinzaMuitoClaro,
  },
  celulaCabecalho: {
    flex: 1,
    padding: 5,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: CORES.brand,
    textTransform: "uppercase",
  },
  celula: {
    flex: 1,
    padding: 5,
    fontSize: 8.5,
    color: CORES.cinza,
  },
  celulaDireita: {
    textAlign: "right",
  },
  listaItem: {
    fontSize: 9,
    color: CORES.cinza,
    marginBottom: 2,
    marginLeft: 8,
  },
  linhaFinanceira: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: CORES.cinzaMuitoClaro,
  },
  linhaFinanceiraLabel: {
    fontSize: 9.5,
    color: CORES.cinzaClaro,
  },
  linhaFinanceiraValor: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: CORES.cinza,
  },
  totalCaixa: {
    backgroundColor: CORES.brandLight,
    borderRadius: 4,
    padding: 12,
    marginTop: 6,
  },
  totalLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: CORES.brand,
    paddingTop: 6,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: CORES.brand,
    textTransform: "uppercase",
  },
  totalValor: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: CORES.accent,
  },
  imagem: {
    width: "48%",
    height: 90,
    objectFit: "cover",
    borderRadius: 4,
  },
  imagensLinha: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  legenda: {
    fontSize: 7.5,
    color: CORES.cinzaClaro,
    marginTop: 2,
  },
  rodape: {
    position: "absolute",
    bottom: "12mm",
    left: "15mm",
    right: "15mm",
  },
  rodapeDivisor: {
    height: 1.5,
    backgroundColor: CORES.accent,
    marginBottom: 6,
  },
  rodapeMarca: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: CORES.accent,
    textTransform: "uppercase",
  },
  rodapeContato: {
    fontSize: 7.5,
    color: CORES.cinzaClaro,
    marginTop: 2,
  },
  rodapeObs: {
    fontSize: 6.5,
    color: "#9CA3AF",
    marginTop: 3,
  },
  paginaNumero: {
    position: "absolute",
    bottom: "12mm",
    right: "15mm",
    fontSize: 8,
    color: CORES.cinzaClaro,
  },
});
