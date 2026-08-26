import { z } from "zod";

// Categorias de fornecimento (ver CategoriaFornecimento em
// lib/types/domain.ts) — substitui `tipo_fornecimento` (dropdown único) e a
// `especialidade` que a migração 014 tinha adicionado por engano em
// Parceiro; agora é múltipla escolha (ver sql-migration-015).
const CategoriaFornecimentoSchema = z.enum(["isolantes", "chaparia", "ferramentas", "ferragens", "outros"]);

export const CreateFornecedorSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do fornecedor."),
  email: z.string().trim().email("E-mail inválido.").nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  cnpj: z.string().trim().nullable().optional(),
  endereco: z.string().trim().nullable().optional(),
  cidade: z.string().trim().nullable().optional(),
  // Sigla vem de um dropdown fixo agora (ModalFornecedor.tsx) — a validação
  // de tamanho continua como salvaguarda de schema.
  estado: z.string().trim().length(2, "Use a sigla do estado (ex.: SP).").nullable().optional(),
  // `tipo_fornecimento` não é mais pedido pela UI (ver ModalFornecedor.tsx) —
  // continua aceito/opcional aqui só por compatibilidade com quem já
  // integrava com o formato antigo.
  tipo_fornecimento: z.enum(["materiais", "equipamentos", "servicos"]).nullable().optional(),
  tipos_fornecimento: z.array(CategoriaFornecimentoSchema).min(1, "Selecione pelo menos um tipo de fornecimento."),
  notas: z.string().trim().nullable().optional(),
  pessoa_contato: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const UpdateFornecedorSchema = CreateFornecedorSchema.partial();

// Anexo de fornecedor (Editar Fornecedor → seção Anexos) — mesmo padrão de
// CreateParceiroAnexoSchema (20 MB por arquivo).
const LIMITE_ANEXO_FORNECEDOR_BYTES = 20 * 1024 * 1024;

export const CreateFornecedorAnexoSchema = z.object({
  fornecedor_id: z.string().min(1),
  nome_arquivo: z.string().trim().min(1),
  tipo_arquivo: z.string().trim().min(1),
  tamanho_bytes: z.number().int().positive().max(LIMITE_ANEXO_FORNECEDOR_BYTES, "Arquivo maior que 20 MB."),
  storage_path: z.string().trim().min(1),
  url: z.string().trim().min(1),
  adicionado_por: z.string().trim().email().nullable().optional(),
});

export type CreateFornecedorInput = z.infer<typeof CreateFornecedorSchema>;
export type UpdateFornecedorInput = z.infer<typeof UpdateFornecedorSchema>;
export type CreateFornecedorAnexoInput = z.infer<typeof CreateFornecedorAnexoSchema>;
