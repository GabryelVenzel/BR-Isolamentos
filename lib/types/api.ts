// Tipos de requisição/resposta HTTP compartilhados entre rotas. Tipos de
// domínio (Cliente, Orçamento, Lead...) ficam em `lib/types/domain.ts`; tipos
// genéricos (ApiResponse, PageResult) em `lib/types/common.ts`.

import type { ListOptions } from "./common";

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
