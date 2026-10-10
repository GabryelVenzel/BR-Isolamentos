// Largura da área de conteúdo por rota. Telas de trabalho com muita coluna
// (Kanbans, tabelas, dashboards) usam a faixa larga; formulários longos e o
// wizard de orçamento ficam na faixa estreita, mais confortável de ler e
// preencher. A barra superior acompanha a mesma largura da tela atual, pra
// logo e menu ficarem alinhados com o conteúdo.

const ROTAS_LARGAS = ["/resumo", "/comercial", "/operacional", "/financeiro", "/historico", "/rh"];

export const LARGURA_ESTREITA = "max-w-6xl";
export const LARGURA_LARGA = "max-w-[1600px]";

export function classeLargura(pathname: string): string {
  const larga = ROTAS_LARGAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
  return larga ? LARGURA_LARGA : LARGURA_ESTREITA;
}
