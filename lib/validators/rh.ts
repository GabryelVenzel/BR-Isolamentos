import { z } from "zod";

// Mesmo limite de 20 MB já usado nos outros anexos do sistema (parceiro/
// fornecedor/lead) — ver CreateFornecedorAnexoSchema em lib/validators/fornecedor.ts.
const LIMITE_ANEXO_RH_BYTES = 20 * 1024 * 1024;

// --- Documentos da empresa (lista solta) ---

export const CreateDocumentoEmpresaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do documento."),
  nome_arquivo: z.string().trim().min(1),
  tipo_arquivo: z.string().trim().min(1),
  tamanho_bytes: z.number().int().positive().max(LIMITE_ANEXO_RH_BYTES, "Arquivo maior que 20 MB."),
  storage_path: z.string().trim().min(1),
  url: z.string().trim().min(1),
  adicionado_por: z.string().trim().email().nullable().optional(),
});

// Editar um documento da empresa (pedido explícito: "gerando uma lista que
// pode ser excluída ou editada") — só o nome é editável, o arquivo em si se
// troca excluindo e reanexando.
export const UpdateDocumentoEmpresaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do documento."),
});

// --- Funcionários ---

const StatusFuncionarioSchema = z.enum(["ativo", "inativo", "desligado"]);

export const CreateFuncionarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do funcionário."),
  cargo: z.string().trim().nullable().optional(),
  cpf: z.string().trim().nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  email: z.string().trim().email("E-mail inválido.").nullable().optional().or(z.literal("")),
  data_admissao: z.string().trim().nullable().optional(),
  status: StatusFuncionarioSchema.optional(),
  notas: z.string().trim().nullable().optional(),
});

export const UpdateFuncionarioSchema = CreateFuncionarioSchema.partial();

// --- Anexos de funcionário (N por pessoa) ---

export const CreateFuncionarioAnexoSchema = z.object({
  funcionario_id: z.string().min(1),
  nome: z.string().trim().min(1, "Informe o nome do documento."),
  nome_arquivo: z.string().trim().min(1),
  tipo_arquivo: z.string().trim().min(1),
  tamanho_bytes: z.number().int().positive().max(LIMITE_ANEXO_RH_BYTES, "Arquivo maior que 20 MB."),
  storage_path: z.string().trim().min(1),
  url: z.string().trim().min(1),
  adicionado_por: z.string().trim().email().nullable().optional(),
});

// Renomear um documento de funcionário — mesma ideia de
// UpdateDocumentoEmpresaSchema.
export const UpdateFuncionarioAnexoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do documento."),
});

export type CreateDocumentoEmpresaInput = z.infer<typeof CreateDocumentoEmpresaSchema>;
export type UpdateDocumentoEmpresaInput = z.infer<typeof UpdateDocumentoEmpresaSchema>;
export type CreateFuncionarioInput = z.infer<typeof CreateFuncionarioSchema>;
export type UpdateFuncionarioInput = z.infer<typeof UpdateFuncionarioSchema>;
export type CreateFuncionarioAnexoInput = z.infer<typeof CreateFuncionarioAnexoSchema>;
export type UpdateFuncionarioAnexoInput = z.infer<typeof UpdateFuncionarioAnexoSchema>;
