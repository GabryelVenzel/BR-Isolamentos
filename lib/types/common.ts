// Tipos genéricos reutilizados por mais de um módulo — nada de domínio de
// negócio aqui (isso vai em `lib/types/domain.ts` ou `lib/contexts/*`).

/** Página de resultados paginados (listagens de leads, orçamentos, parceiros, etc.). */
export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Envelope padrão de resposta das APIs dos MÓDULOS NOVOS do ERP (comercial,
 * operacional, financeiro, resumo). As rotas legadas (`/api/orcamentos`,
 * `/api/clientes`, etc.) continuam devolvendo o corpo "cru" por compatibilidade
 * com o frontend existente — ver `CONVENTIONS.md` para a justificativa. */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    timestamp: string;
  };
}

export function apiSuccess<T>(data: T, meta?: Partial<ApiResponse<T>["meta"]>): ApiResponse<T> {
  return { success: true, data, meta: { timestamp: new Date().toISOString(), ...meta } };
}

export function apiError(error: string): ApiResponse<never> {
  return { success: false, error, meta: { timestamp: new Date().toISOString() } };
}

/** Campos presentes em toda entidade persistida no Supabase que segue o padrão
 * dos módulos novos (os já existentes usam `criado_em`/`atualizado_em` em
 * português — mantidos como estão em `lib/types.ts` para não gerar migração). */
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

/** Parâmetros comuns de listagem paginada/ordenada usados pelos repositórios. */
export interface ListOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
}
