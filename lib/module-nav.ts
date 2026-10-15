// Listas de itens do ModuleSubNav (components/ModuleSubNav.tsx) por módulo.
// Centralizado aqui porque o módulo Orçamento precisa da mesma lista em 3
// layouts diferentes (novo-orcamento, historico, config-precos — três rotas
// de topo separadas, sem um segmento "/orcamento" pai comum; unificar as
// URLs delas é uma mudança maior, fora do escopo desta reorganização de
// navegação).

import type { ModuleSubNavItem } from "@/components/ModuleSubNav";

// Abas do Resumo e do Comercial são estado da página (?tab= / ?aba=), mas
// aparecem também na gaveta do menu do celular (components/Navbar.tsx).
export const RESUMO_SUBNAV: ModuleSubNavItem[] = [
  { href: "/resumo?tab=geral", label: "Geral" },
  { href: "/resumo?tab=operacao", label: "Operação" },
  { href: "/resumo?tab=comercial", label: "Comercial" },
  { href: "/resumo?tab=financeira", label: "Financeira" },
];

export const COMERCIAL_SUBNAV: ModuleSubNavItem[] = [
  { href: "/comercial?aba=crm", label: "CRM" },
  { href: "/comercial?aba=clientes", label: "Clientes" },
  { href: "/comercial?aba=configuracoes", label: "Configurações" },
];

// Engenharia: Quente e Frio como subabas (mesmo padrão dos outros módulos).
export const ENGENHARIA_SUBNAV: ModuleSubNavItem[] = [
  { href: "/engenharia/quente", label: "Quente" },
  { href: "/engenharia/frio", label: "Frio" },
];

export const ORCAMENTO_SUBNAV: ModuleSubNavItem[] = [
  { href: "/novo-orcamento", label: "Novo Orçamento" },
  { href: "/historico", label: "Histórico" },
  { href: "/config-precos", label: "Configurações" },
];

// Ordem pedida: Serviços primeiro (aba principal do módulo), Agenda em
// seguida (agora calendário de capacidade — ver app/operacional/page.tsx),
// Parceiros, Fornecedores. "Capacidade" não existe mais como aba própria:
// foi incorporada dentro de Agenda.
export const OPERACIONAL_SUBNAV: ModuleSubNavItem[] = [
  { href: "/operacional/servicos", label: "Serviços" },
  { href: "/operacional", label: "Agenda" },
  // Migração 053 — Parceiros separados: quem executa x quem indica.
  { href: "/operacional/prestadores", label: "Prestadores" },
  { href: "/operacional/parcerias", label: "Parcerias" },
  { href: "/operacional/fornecedores", label: "Fornecedores" },
  // Pedidos de compra, cotações e histórico de preços (migração 044).
  { href: "/operacional/compras", label: "Compras" },
];

// "Dashboard" foi removido (duplicava Resumo → Financeira) e "Categorias" +
// "Configurações" viraram uma aba só (as duas eram pequenas demais pra
// justificar navegação separada) — ver decisões em app/financeiro/page.tsx
// e app/financeiro/categorias/page.tsx.
export const FINANCEIRO_SUBNAV: ModuleSubNavItem[] = [
  { href: "/financeiro/lancamentos", label: "Lançamentos" },
  { href: "/financeiro/custos-fixos", label: "Custos Fixos" },
  // Migração 054 — entradas e saídas previstas, sem lançar.
  { href: "/financeiro/projecao", label: "Projeção" },
  { href: "/financeiro/categorias", label: "Configurações" },
];

// Módulo RH (migração 033) — "Empresa" (documentos soltos da empresa) e
// "Funcionários" (cadastro + documentação por pessoa), nessa ordem (pedido
// explícito).
export const RH_SUBNAV: ModuleSubNavItem[] = [
  { href: "/rh", label: "Empresa" },
  { href: "/rh/funcionarios", label: "Funcionários" },
  // Usuários e níveis de acesso (migração 039) — só administradores veem.
  { href: "/rh/usuarios", label: "Usuários", apenasAdmin: true },
  // Migração 052 — tipos de documento e documentos obrigatórios da empresa.
  // "Configurações" é sempre a última aba de cada módulo (revisão de usabilidade).
  { href: "/rh/configuracoes", label: "Configurações" },
];
