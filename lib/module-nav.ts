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

// Ordem pedida: Serviços primeiro (aba principal do módulo), Agenda em
// seguida (agora calendário de capacidade — ver app/operacional/page.tsx),
// Parceiros, Fornecedores. "Capacidade" não existe mais como aba própria:
// foi incorporada dentro de Agenda.
export const OPERACIONAL_SUBNAV: ModuleSubNavItem[] = [
  { href: "/operacional/servicos", label: "Serviços" },
  { href: "/operacional", label: "Agenda" },
  { href: "/operacional/parceiros", label: "Parceiros" },
  { href: "/operacional/fornecedores", label: "Fornecedores" },
];

// "Dashboard" foi removido (duplicava Resumo → Financeira) e "Categorias" +
// "Configurações" viraram uma aba só (as duas eram pequenas demais pra
// justificar navegação separada) — ver decisões em app/financeiro/page.tsx
// e app/financeiro/categorias/page.tsx.
export const FINANCEIRO_SUBNAV: ModuleSubNavItem[] = [
  { href: "/financeiro/lancamentos", label: "Lançamentos" },
  { href: "/financeiro/custos-fixos", label: "Custos Fixos" },
  { href: "/financeiro/categorias", label: "Categorias & Config" },
];
