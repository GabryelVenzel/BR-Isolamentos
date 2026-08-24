import { z } from "zod";

const TipoTrabalhoOperacionalSchema = z.enum([
  "bancada",
  "caldeiraria",
  "isolamentos_removiveis",
  "isolamentos_fixos",
]);

export const CreateParceiroSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do parceiro."),
  email: z.string().trim().email("E-mail inválido.").nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  cnpj: z.string().trim().nullable().optional(),
  endereco: z.string().trim().nullable().optional(),
  cidade: z.string().trim().nullable().optional(),
  estado: z.string().trim().length(2, "Use a sigla do estado (ex.: SP).").nullable().optional(),
  cpf: z.string().trim().nullable().optional(),
  conta_bancaria: z.string().trim().nullable().optional(),
  especialidades: z.array(z.string().trim().min(1)).optional(),
  disponibilidade_horas_semana: z.number().nonnegative().nullable().optional(),
  disponibilidade_dias: z.array(z.string().trim().min(1)).optional(),
  custo_hora: z.number().nonnegative().nullable().optional(),
  // Pelo menos um tipo de trabalho, conforme o pedido — mas só exigido na
  // CRIAÇÃO (UpdateParceiroSchema é .partial(), então uma edição parcial que
  // não mexe nesse campo não é bloqueada).
  tipos_trabalho: z.array(TipoTrabalhoOperacionalSchema).min(1, "Selecione pelo menos um tipo de trabalho."),
  notas_bancada: z.string().trim().nullable().optional(),
  notas_caldeiraria: z.string().trim().nullable().optional(),
  notas_isolamentos_removiveis: z.string().trim().nullable().optional(),
  notas_isolamentos_fixos: z.string().trim().nullable().optional(),
  total_pessoas: z.number().int().positive("Total de pessoas deve ser maior que zero.").nullable().optional(),
  ativo: z.boolean().optional(),
});

export const UpdateParceiroSchema = CreateParceiroSchema.partial();

export type CreateParceiroInput = z.infer<typeof CreateParceiroSchema>;
export type UpdateParceiroInput = z.infer<typeof UpdateParceiroSchema>;
