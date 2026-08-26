import { z } from "zod";

// Classificação fixa do fornecedor (ver EspecialidadeFornecedor em
// lib/types/domain.ts) — movida de Parceiro pra cá em sql-migration-014
// (correção: quem fornece MATERIAL é Fornecedor, não Parceiro).
const EspecialidadeFornecedorSchema = z.enum(["isolantes", "chaparia", "ferramentas", "ferragens", "outros"]);

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
  especialidade: EspecialidadeFornecedorSchema.nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  pessoa_contato: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const UpdateFornecedorSchema = CreateFornecedorSchema.partial();

export type CreateFornecedorInput = z.infer<typeof CreateFornecedorSchema>;
export type UpdateFornecedorInput = z.infer<typeof UpdateFornecedorSchema>;
