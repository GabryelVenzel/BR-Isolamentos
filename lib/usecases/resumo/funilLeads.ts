import type { LeadRepository } from "../../repositories";
import type { EtapaFunilResumo } from "../../types/resumo";

const ETAPAS_FUNIL = ["prospeccao", "contato", "proposta", "negociacao", "fechado"] as const;
const LABELS: Record<(typeof ETAPAS_FUNIL)[number], string> = {
  prospeccao: "Prospecção",
  contato: "Contato",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado: "Fechado",
};

export interface FunilResultado {
  etapas: EtapaFunilResumo[];
  gargalo: { deEtapa: string; paraEtapa: string; quedaPercentual: number } | null;
}

/** Funil de conversão do pipeline comercial — "perdido" fica de fora
 * (é saída do funil, não uma etapa de progresso) para o cálculo de
 * retenção fazer sentido como uma sequência decrescente. Usa a view
 * `v_leads_por_etapa` (todo o histórico, não filtrado por período — o funil
 * representa o pipeline atual, não uma janela de tempo). */
export async function funilLeads(leadRepo: LeadRepository): Promise<FunilResultado> {
  const porEtapa = await leadRepo.porEtapaView();
  const mapa = new Map(porEtapa.map((e) => [e.etapa, e]));

  const etapas: EtapaFunilResumo[] = ETAPAS_FUNIL.map((etapa, index) => {
    const linha = mapa.get(etapa);
    const quantidade = linha?.total ?? 0;
    const valorTotal = linha?.valor_total ?? 0;

    let retencaoPercentual: number | null = null;
    if (index > 0) {
      const anterior = mapa.get(ETAPAS_FUNIL[index - 1])?.total ?? 0;
      retencaoPercentual = anterior > 0 ? (quantidade / anterior) * 100 : 0;
    }

    return { etapa, label: LABELS[etapa], quantidade, valorTotal, retencaoPercentual };
  });

  // Gargalo = maior queda percentual entre etapas consecutivas (menor
  // retenção). Ignora etapas sem lead nenhum na anterior (retenção 0 por
  // divisão vazia não é um "gargalo real", é ausência de dado).
  let gargalo: FunilResultado["gargalo"] = null;
  for (let i = 1; i < etapas.length; i++) {
    const anterior = etapas[i - 1];
    const atual = etapas[i];
    if (anterior.quantidade === 0 || atual.retencaoPercentual === null) continue;

    const queda = 100 - atual.retencaoPercentual;
    if (!gargalo || queda > gargalo.quedaPercentual) {
      gargalo = { deEtapa: anterior.label, paraEtapa: atual.label, quedaPercentual: queda };
    }
  }

  return { etapas, gargalo };
}
