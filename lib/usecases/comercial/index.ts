export { atualizarLead } from "./atualizarLead";
export { criarLead } from "./criarLead";
export { moverLead } from "./moverLead";
export type { MoverLeadInput } from "./moverLead";
export { mudarTemperatura } from "./mudarTemperatura";
export { reativarLeadFrio } from "./reativarLeadFrio";
export { cancelarAgendamentoFrio } from "./cancelarAgendamentoFrio";
export { verificarReativacoesPendentes } from "./verificarReativacoesPendentes";
export { registrarInteracao } from "./registrarInteracao";
export { anexarArquivoLead } from "./anexarArquivoLead";
export { vincularOrcamento } from "./vincularOrcamento";
export { anexarPrazoEtapa, anexarTotalAnexos, calcularDiasNaEtapaAtual } from "./prazoEtapa";
export {
  calcularComissoes,
  calcularFunil,
  calcularKpis,
  calcularLeadsDormindo,
  calcularLeadsFriosResumo,
  calcularLeadsPorOrigem,
  calcularPerformancePorResponsavel,
  calcularTempoMedioPorEtapa,
  gerarRelatorioComercial,
} from "./relatorio";
export type {
  EtapaFunilRelatorio,
  FunilComercial,
  KpisComercial,
  LeadsFriosResumo,
  LeadsPorOrigem,
  PerformanceResponsavel,
  RelatorioComercial,
  RelatorioComissoes,
  ResumoComissaoPorParceiro,
  ResumoComissaoPorStatus,
  StatusComissao,
  TempoMedioEtapa,
} from "./relatorio";
