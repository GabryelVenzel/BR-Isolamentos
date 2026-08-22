// Listas de itens do ModuleSubNav (components/ModuleSubNav.tsx) por módulo.
// Centralizado aqui porque o módulo Orçamento precisa da mesma lista em 3
// layouts diferentes (novo-orcamento, historico, config-precos — três rotas
// de topo separadas, sem um segmento "/orcamento" pai comum; unificar as
// URLs delas é uma mudança maior, fora do escopo desta reorganização de
// navegação).

import type { ModuleSubNavItem } from "@/components/ModuleSubNav";

export const ORCAMENTO_SUBNAV: ModuleSubNavItem[] = [
  { href: "/novo-orcamento", label: "Novo Orçamento" },
  { href: "/historico", label: "Histórico" },
  { href: "/config-precos", label: "Configurar Preços" },
];

export const OPERACIONAL_SUBNAV: ModuleSubNavItem[] = [
  { href: "/operacional", label: "Agenda" },
  { href: "/operacional/parceiros", label: "Parceiros" },
];

export const FINANCEIRO_SUBNAV: ModuleSubNavItem[] = [
  { href: "/financeiro", label: "Lançamentos" },
  { href: "/financeiro/custos-fixos", label: "Custos Fixos" },
];
