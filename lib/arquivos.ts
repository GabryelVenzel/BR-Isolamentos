// Anexos em buckets PRIVADOS (migração 038). As tabelas continuam guardando
// a URL no formato "público" do Supabase Storage
// (.../storage/v1/object/public/<bucket>/<caminho>) — é o que já está gravado
// em todos os registros antigos. Com o bucket privado essa URL não abre mais
// sozinha: toda exibição passa por `urlArquivo`, que a converte para a rota
// interna /api/arquivo/<bucket>/<caminho> (confere a sessão e redireciona pra
// um link temporário — ver app/api/arquivo/[...caminho]/route.ts).

import type { Modulo } from "./acesso";

const MARCADOR_PUBLICO = "/storage/v1/object/public/";

/** Buckets cujo conteúdo exige um módulo específico (os demais abrem pra
 * qualquer usuário ativo). Espelha as regras de Storage da migração 039. */
export const MODULO_DO_BUCKET: Record<string, Modulo> = {
  "rh-empresa-anexos": "rh",
  "rh-funcionarios-anexos": "rh",
  "lancamentos-anexos": "financeiro",
};

export const BUCKETS_CONHECIDOS = [
  "propostas-imagens",
  "servicos-anexos",
  "lancamentos-anexos",
  "leads-anexos",
  "parceiros-anexos",
  "fornecedores-anexos",
  "rh-empresa-anexos",
  "rh-funcionarios-anexos",
] as const;

/** Converte a URL gravada de um anexo no endereço que o navegador deve
 * abrir. `baixarComo` força o download com aquele nome de arquivo (o
 * atributo `download` do <a> não funciona em link de outro domínio). URLs
 * que não são do Storage passam direto. */
export function urlArquivo(url: string | null | undefined, opcoes?: { baixarComo?: string }): string {
  if (!url) return "";
  const indice = url.indexOf(MARCADOR_PUBLICO);
  if (indice === -1) return url;
  const resto = url.slice(indice + MARCADOR_PUBLICO.length).split("?")[0];
  const sufixo = opcoes?.baixarComo ? `?baixar=${encodeURIComponent(opcoes.baixarComo)}` : "";
  return `/api/arquivo/${resto}${sufixo}`;
}
