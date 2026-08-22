// Tipos de requisição/resposta HTTP compartilhados entre rotas. Tipos de
// domínio (Cliente, Orçamento, Lead...) ficam em `lib/types/domain.ts`; tipos
// genéricos (ApiResponse, PageResult) em `lib/types/common.ts`.

import type { ListOptions } from "./common";
import type { FiltrosResumo, Periodo, TipoTrabalhoFiltro } from "./resumo";

const PERIODOS_VALIDOS: Periodo[] = ["7d", "30d", "90d", "mes", "ano", "tudo", "custom"];
const TIPOS_VALIDOS: TipoTrabalhoFiltro[] = ["quente", "frio", "misto"];

/** Parseia os filtros da FilterBar do dashboard (módulo Resumo) a partir da
 * query string — usado por todas as rotas de app/api/resumo/*. */
export function parseFiltrosResumo(searchParams: URLSearchParams): FiltrosResumo {
  const periodoParam = searchParams.get("periodo");
  const periodo = PERIODOS_VALIDOS.includes(periodoParam as Periodo) ? (periodoParam as Periodo) : "mes";

  const tipoParam = searchParams.get("tipo");
  const tipoTrabalho = TIPOS_VALIDOS.includes(tipoParam as TipoTrabalhoFiltro)
    ? (tipoParam as TipoTrabalhoFiltro)
    : undefined;

  return {
    periodo,
    dataInicioCustom: searchParams.get("dataInicio") ?? undefined,
    dataFimCustom: searchParams.get("dataFim") ?? undefined,
    tipoTrabalho,
    responsavel: searchParams.get("responsavel") ?? undefined,
  };
}

/** Query string comum a listagens: paginação + busca textual livre. */
export interface ListQueryParams extends ListOptions {
  busca?: string;
}

/** Parseia os `searchParams` de uma `NextRequest`/`URL` para `ListQueryParams`,
 * com defaults sãos (page 1, pageSize 20). Usado pelas rotas GET de listagem. */
export function parseListQueryParams(searchParams: URLSearchParams): ListQueryParams {
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");

  return {
    busca: searchParams.get("busca") ?? undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20,
    orderBy: searchParams.get("orderBy") ?? undefined,
    ascending: searchParams.get("ascending") !== "false",
  };
}
