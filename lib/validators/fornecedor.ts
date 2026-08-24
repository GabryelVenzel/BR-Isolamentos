import { z } from "zod";

export const CreateFornecedorSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do fornecedor."),
  email: z.string().trim().email("E-mail inválido.").nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  cnpj: z.string().trim().nullable().optional(),
  endereco: z.string().trim().nullable().optional(),
  cidade: z.string().trim().nullable().optional(),
  estado: z.string().trim().length(2, "Use a sigla do estado (ex.: SP).").nullable().optional(),
  // Sem customizar a mensagem de obrigatório (mesma convenção do resto do
  // projeto — ver comentário em lib/validators/lead.ts — o path do campo já
  // vem junto na mensagem final via formatarErrosZod).
  tipo_fornecimento: z.enum(["materiais", "equipamentos", "servicos"]),
  especialidade: z.string().trim().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  pessoa_contato: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const UpdateFornecedorSchema = CreateFornecedorSchema.partial();

export type CreateFornecedorInput = z.infer<typeof CreateFornecedorSchema>;
export type UpdateFornecedorInput = z.infer<typeof UpdateFornecedorSchema>;
