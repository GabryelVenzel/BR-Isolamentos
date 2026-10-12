// Lixeira (migrações 045 e 047) — o que é comum à tela e ao servidor.
//
// "Excluir" um serviço, lead, orçamento, cliente ou lançamento só marca o
// registro como excluído (`excluido_em`/`excluido_por`): ele some das telas,
// das somas e dos relatórios, mas continua no banco. Da lixeira, um
// administrador pode RESTAURAR ou EXCLUIR DE VEZ; o que ficar
// `DIAS_NA_LIXEIRA` dias lá é removido de vez pela rotina diária.

/** Quantos dias um registro excluído fica na lixeira antes de ser removido
 * de vez pela rotina diária (app/api/cron/diario). */
export const DIAS_NA_LIXEIRA = 30;

export const TIPOS_LIXEIRA = ["servicos", "leads", "orcamentos", "clientes", "lancamentos"] as const;
export type TipoLixeira = (typeof TIPOS_LIXEIRA)[number];

export function ehTipoLixeira(valor: unknown): valor is TipoLixeira {
  return typeof valor === "string" && (TIPOS_LIXEIRA as readonly string[]).includes(valor);
}

/** Um registro na lixeira, já resumido para exibição. */
export interface ItemLixeira {
  id: string;
  titulo: string;
  detalhe: string | null;
  excluido_em: string;
  excluido_por: string | null;
}

export const LIXEIRA: Record<TipoLixeira, { titulo: string; plural: string; aoExcluirDeVez: string }> = {
  servicos: {
    titulo: "Lixeira de serviços",
    plural: "Serviços excluídos",
    aoExcluirDeVez:
      "Parceiros, diárias, linha do tempo e interações da obra são apagados. Os lançamentos financeiros continuam existindo, mas perdem o vínculo com a obra.",
  },
  leads: {
    titulo: "Lixeira de leads",
    plural: "Leads excluídos",
    aoExcluirDeVez: "Histórico, interações e anexos do lead são apagados junto.",
  },
  orcamentos: {
    titulo: "Lixeira de orçamentos",
    plural: "Orçamentos excluídos",
    aoExcluirDeVez: "Os itens do orçamento são apagados junto, e leads ou serviços que apontavam para ele ficam sem orçamento vinculado.",
  },
  clientes: {
    titulo: "Lixeira de clientes",
    plural: "Clientes excluídos",
    aoExcluirDeVez: "O cadastro do cliente é apagado.",
  },
  lancamentos: {
    titulo: "Lixeira de lançamentos",
    plural: "Lançamentos excluídos",
    aoExcluirDeVez: "O lançamento e o vínculo com seus comprovantes são apagados.",
  },
};

export function diasRestantesNaLixeira(excluidoEm: string, agora: number = Date.now()): number {
  const passados = (agora - new Date(excluidoEm).getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(DIAS_NA_LIXEIRA - passados));
}
