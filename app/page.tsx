import { redirect } from "next/navigation";

/** "/" existe só por compatibilidade (favicon, bookmarks antigos, digitar
 * a raiz do domínio) — o módulo Resumo mora em /resumo, mesmo padrão dos
 * outros 5 módulos (cada um com seu próprio segmento de rota). */
export default function RootPage() {
  redirect("/resumo");
}
