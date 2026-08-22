export * from "./agendamento";
export * from "./cliente";
export * from "./engenharia";
export * from "./financeiro";
export * from "./lead";
export * from "./orcamento";
export * from "./parceiro";

// --- Helper comum de uso em API routes ---

import { ZodError, type ZodType } from "zod";
import { ValidationError } from "../errors";

/** Valida `input` contra `schema`; em caso de falha, lança `ValidationError`
 * (400) com uma mensagem já concatenada dos campos inválidos, pronta para a
 * resposta HTTP. Uso:
 *
 *   const dados = parseOrThrow(CreateLeadSchema, await request.json());
 */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const resultado = schema.safeParse(input);
  if (!resultado.success) {
    const mensagem = formatarErrosZod(resultado.error);
    throw new ValidationError(mensagem, resultado.error.issues);
  }
  return resultado.data;
}

function formatarErrosZod(error: ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
}
