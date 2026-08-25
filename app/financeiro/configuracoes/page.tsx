import { redirect } from "next/navigation";

/** Rota antiga — Configurações foi fundida em Categorias (ver
 * app/financeiro/categorias/page.tsx e a decisão no commit: "simplificar
 * Financeiro, juntar Categorias+Configurações"). Mantida como redirect pra
 * não quebrar links/favoritos já salvos apontando pra cá. */
export default function ConfiguracoesFinanceiroRedirect() {
  redirect("/financeiro/categorias");
}
