import { redirect } from "next/navigation";

/** Aba "Dashboard" removida por pedido ("simplificar Financeiro, remover
 * Dashboard") — o mesmo conteúdo (KPIs + gráficos financeiros) já existe,
 * mais completo, em Resumo → Financeira (ver
 * components/modules/resumo/DashboardFinanceira.tsx), então mantinha dois
 * lugares mostrando o mesmo dashboard. `/financeiro` (raiz do módulo)
 * redireciona pra Lançamentos, a aba mais usada no dia a dia. */
export default function FinanceiroRootRedirect() {
  redirect("/financeiro/lancamentos");
}
