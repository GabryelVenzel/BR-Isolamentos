// Logger central da aplicação. Objetivo hoje é padronizar o formato dos logs
// (nível + timestamp + contexto estruturado) para facilitar debugging local e
// leitura nos logs da Vercel; nenhum código deve chamar `console.log` direto.
//
// Quando o volume de uso justificar, trocar o `output` interno por um
// provedor de error tracking (Sentry, LogRocket, Axiom, etc.) sem precisar
// alterar os call sites — é só reimplementar as 4 funções abaixo.

type LogData = Record<string, unknown> | undefined;

function timestamp(): string {
  return new Date().toISOString();
}

/** Remove campos sensíveis antes de logar (nunca logar senha/token/cookie inteiros). */
const CHAVES_SENSIVEIS = ["senha", "password", "token", "cookie", "authorization"];

function sanitizar(data: LogData): LogData {
  if (!data) return data;
  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(data)) {
    limpo[chave] = CHAVES_SENSIVEIS.some((s) => chave.toLowerCase().includes(s)) ? "[REDACTED]" : valor;
  }
  return limpo;
}

export const logger = {
  /** Eventos normais do fluxo de negócio (ex.: "Orçamento criado", { id }). */
  info(message: string, data?: LogData): void {
    console.log(`[INFO] ${timestamp()} ${message}`, sanitizar(data) ?? "");
  },

  /** Situação anômala mas não fatal (ex.: fallback usado, dado ausente e ignorado). */
  warn(message: string, data?: LogData): void {
    console.warn(`[WARN] ${timestamp()} ${message}`, sanitizar(data) ?? "");
  },

  /** Falhas — sempre que um `catch` trata um erro inesperado. Aceita o próprio erro
   * como segundo argumento (stack é preservado). */
  error(message: string, error?: unknown, data?: LogData): void {
    console.error(`[ERROR] ${timestamp()} ${message}`, error, sanitizar(data) ?? "");
  },

  /** Só aparece em desenvolvimento — detalhes verbosos de fluxo (payloads, queries). */
  debug(message: string, data?: LogData): void {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] ${timestamp()} ${message}`, sanitizar(data) ?? "");
    }
  },
};
