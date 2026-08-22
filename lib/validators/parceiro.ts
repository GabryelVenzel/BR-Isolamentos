import { z } from "zod";

export const CreateParceiroSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do parceiro."),
  email: z.string().trim().email("E-mail inválido.").nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  endereco: z.string().trim().nullable().optional(),
  cidade: z.string().trim().nullable().optional(),
  estado: z.string().trim().length(2, "Use a sigla do estado (ex.: SP).").nullable().optional(),
  cpf: z.string().trim().nullable().optional(),
  conta_bancaria: z.string().trim().nullable().optional(),
  especialidades: z.array(z.string().trim().min(1)).optional(),
  disponibilidade_horas_semana: z.number().nonnegative().nullable().optional(),
  disponibilidade_dias: z.array(z.string().trim().min(1)).optional(),
  custo_hora: z.number().nonnegative().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const UpdateParceiroSchema = CreateParceiroSchema.partial();

export type CreateParceiroInput = z.infer<typeof CreateParceiroSchema>;
export type UpdateParceiroInput = z.infer<typeof UpdateParceiroSchema>;
