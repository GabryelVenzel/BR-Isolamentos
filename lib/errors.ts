// Hierarquia de erros da aplicação. Toda rota de API (existente ou dos futuros
// módulos do ERP) deve capturar erros previstos como instâncias de `AppError` —
// isso permite mapear o `statusCode` certo na resposta HTTP sem precisar checar
// mensagens de texto. Erros que NÃO são `AppError` (bug inesperado, falha do
// Supabase, etc.) devem cair no branch genérico 500 e ser logados com
// `logger.error` para investigação.
//
// Uso típico numa API route:
//
//   try {
//     const lead = await leadRepo.findById(id);
//     if (!lead) throw new NotFoundError("Lead não encontrado.");
//     ...
//   } catch (error) {
//     return errorResponse(error);
//   }

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    // Mantém o stack trace correto em V8 (Node/Next.js) apontando para onde o
    // erro foi lançado, não para este construtor.
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }
}

/** Recurso não encontrado (registro inexistente, id inválido, etc.) → HTTP 404. */
export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado.") {
    super(message, 404, "NOT_FOUND");
  }
}

/** Entrada inválida (falha de validação Zod, campo obrigatório ausente) → HTTP 400. */
export class ValidationError extends AppError {
  constructor(message = "Dados inválidos.", public readonly detalhes?: unknown) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

/** Usuário não autenticado ou sem sessão válida → HTTP 401. */
export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

/** Usuário autenticado mas sem permissão para a ação (ex.: role errada) → HTTP 403. */
export class ForbiddenError extends AppError {
  constructor(message = "Sem permissão para executar esta ação.") {
    super(message, 403, "FORBIDDEN");
  }
}

/** Conflito de estado (ex.: transição de etapa inválida, registro duplicado) → HTTP 409. */
export class ConflictError extends AppError {
  constructor(message = "Conflito de estado.") {
    super(message, 409, "CONFLICT");
  }
}

/** Configuração de negócio ausente/inconsistente impede a operação (ex.: RBT12 do
 * Simples Nacional não configurado) → HTTP 422. Equivalente à antiga
 * `OrcamentoConfigError` de `lib/orcamento.ts`, generalizada para qualquer módulo. */
export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 422, "CONFIGURATION_ERROR");
  }
}

/** Funcionalidade planejada mas ainda não implementada (usado pelos contextos dos
 * módulos futuros do ERP enquanto as tabelas/telas correspondentes não existem). */
export class NotImplementedError extends AppError {
  constructor(message = "Funcionalidade ainda não implementada.") {
    super(message, 501, "NOT_IMPLEMENTED");
  }
}

/** Códigos de erro do Postgres (via PostgREST/Supabase-js, que devolve
 * `{ message, details, hint, code }` — `code` é o SQLSTATE de 5 dígitos)
 * que valem a pena virar uma mensagem legível em vez do 500 genérico. Bug
 * relatado (2x, em módulos diferentes: exclusão de cliente com orçamento
 * vinculado, criação de categoria com nome duplicado): qualquer violação de
 * constraint do banco — chave estrangeira, valor único, campo obrigatório —
 * é um erro totalmente PREVISÍVEL de entrada do usuário, não um bug, mas
 * `toHttpError` tratava tudo que não fosse `AppError` como "Erro interno do
 * servidor.", sem diferenciar. Mapeado aqui uma vez, pra toda rota de API se
 * beneficiar — não só o caso específico que foi corrigido individualmente
 * primeiro (ver app/api/clientes/[id]/route.ts). */
const CODIGOS_POSTGRES: Record<string, { message: string; statusCode: number; code: string }> = {
  "23505": { message: "Já existe um registro com esse mesmo valor (ex.: nome duplicado).", statusCode: 409, code: "CONFLICT" },
  "23503": { message: "Não é possível concluir: existem outros registros vinculados a este.", statusCode: 409, code: "CONFLICT" },
  "23502": { message: "Um campo obrigatório não foi informado.", statusCode: 400, code: "VALIDATION_ERROR" },
  "23514": { message: "Um dos valores informados não é permitido.", statusCode: 400, code: "VALIDATION_ERROR" },
};

/** Converte qualquer erro capturado em `{ message, statusCode }` pronto para uma
 * resposta HTTP. Erros desconhecidos (não-`AppError`, não um erro de
 * constraint do Postgres reconhecido) viram 500 genérico — a mensagem
 * original é preservada só em desenvolvimento para não vazar detalhes
 * internos em produção. */
export function toHttpError(error: unknown): { message: string; statusCode: number; code: string } {
  if (error instanceof AppError) {
    return { message: error.message, statusCode: error.statusCode, code: error.code };
  }

  const codigoPostgres = (error as { code?: string } | null)?.code;
  if (codigoPostgres && codigoPostgres in CODIGOS_POSTGRES) {
    return CODIGOS_POSTGRES[codigoPostgres];
  }

  const message =
    process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : "Erro interno do servidor.";

  return { message, statusCode: 500, code: "INTERNAL_ERROR" };
}
