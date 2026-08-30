import { z } from "zod";

/** Validação de entrada para criar/atualizar cliente. Espelha as colunas
 * NOT NULL/nullable de `clientes` em `sql-schema.sql`. */
export const CreateClienteSchema = z.object({
  // Nome fantasia (migração 031, ver comentário em lib/types.ts#Cliente) —
  // continua sendo o campo `nome`.
  nome: z.string().trim().min(1, "Informe o nome do cliente."),
  razao_social: z.string().trim().nullable().optional(),
  email: z.string().trim().email("E-mail inválido.").nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  endereco: z.string().trim().nullable().optional(),
  cidade: z.string().trim().nullable().optional(),
  estado: z.string().trim().max(2, "Use a sigla do estado (ex.: PR).").nullable().optional(),
  cnpj_cpf: z.string().trim().nullable().optional(),
});

export const UpdateClienteSchema = CreateClienteSchema.partial();

export type CreateClienteInput = z.infer<typeof CreateClienteSchema>;
export type UpdateClienteInput = z.infer<typeof UpdateClienteSchema>;
