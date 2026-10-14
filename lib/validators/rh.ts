import { z } from "zod";
import { validarCpf } from "../mascaras";

// Mesmo limite de 20 MB já usado nos outros anexos do sistema (parceiro/
// fornecedor/lead) — ver CreateFornecedorAnexoSchema em lib/validators/fornecedor.ts.
const LIMITE_ANEXO_RH_BYTES = 20 * 1024 * 1024;

// Validade de um documento (migração 042) — opcional; vazio = não vence.
const Validade = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de validade inválida.")
  .nullable()
  .optional();

// --- Documentos da empresa (lista solta) ---

const Data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .nullable()
  .optional();
const TextoOpcional = z.string().trim().nullable().optional();
const CategoriaDocumento = z.enum(["juridico", "fiscal", "sst", "contratos", "outros"]).nullable().optional();

export const CreateDocumentoEmpresaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do documento."),
  validade: Validade,
  // Migração 052 — categoria, item da lista de obrigatórios e, ao RENOVAR, o
  // documento que esta versão substitui (vira histórico).
  categoria: CategoriaDocumento,
  tipo_id: TextoOpcional,
  substitui_id: z.string().uuid().nullable().optional(),
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
  validade: Validade,
  categoria: CategoriaDocumento,
  tipo_id: TextoOpcional,
});

// --- Funcionários ---

const StatusFuncionarioSchema = z.enum(["ativo", "inativo", "desligado"]);

export const CreateFuncionarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do funcionário."),
  // Funções que exerce (migração 044) — mesma lista de parceiros e obras.
  tipos_trabalho: z
    .array(z.enum(["bancada", "isolador", "funileiro_tracador", "caldeiraria", "caldeiraria_montagem", "removivel_montagem", "removivel_fabricacao", "ajudante"]))
    .optional(),
  cargo: z.string().trim().nullable().optional(),
  cpf: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine((v) => !v || validarCpf(v), "CPF inválido — confira os números."),
  telefone: z.string().trim().nullable().optional(),
  email: z.string().trim().email("E-mail inválido.").nullable().optional().or(z.literal("")),
  data_admissao: z.string().trim().nullable().optional(),
  status: StatusFuncionarioSchema.optional(),
  notas: z.string().trim().nullable().optional(),
  // Migração 052.
  vinculo: z.enum(["clt", "pj", "socio", "diarista", "outro"]).nullable().optional(),
  data_desligamento: Data,
  tamanho_camisa: TextoOpcional,
  tamanho_calca: TextoOpcional,
  tamanho_botina: TextoOpcional,
  tamanho_luva: TextoOpcional,
  // Dados sensíveis (tabela funcionario_dados) — vêm junto no mesmo
  // formulário e são gravados à parte.
  dados: z
    .object({
      rg: TextoOpcional,
      data_nascimento: Data,
      cep: TextoOpcional,
      endereco: TextoOpcional,
      cidade: TextoOpcional,
      estado: TextoOpcional,
      contato_emergencia_nome: TextoOpcional,
      contato_emergencia_telefone: TextoOpcional,
      contato_emergencia_parentesco: TextoOpcional,
      salario: z.number().nonnegative().nullable().optional(),
      valor_diaria: z.number().nonnegative().nullable().optional(),
      pis: TextoOpcional,
      ctps: TextoOpcional,
      banco: TextoOpcional,
      agencia: TextoOpcional,
      conta: TextoOpcional,
      tipo_conta: TextoOpcional,
      chave_pix: TextoOpcional,
    })
    .optional(),
});

export const UpdateFuncionarioSchema = CreateFuncionarioSchema.partial();

// --- Anexos de funcionário (N por pessoa) ---

export const CreateFuncionarioAnexoSchema = z.object({
  funcionario_id: z.string().min(1),
  nome: z.string().trim().min(1, "Informe o nome do documento."),
  validade: Validade,
  // Migração 052 — tipo padrão e data de emissão.
  tipo_id: TextoOpcional,
  data_emissao: Data,
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
  validade: Validade,
  tipo_id: TextoOpcional,
  data_emissao: Data,
});

export type CreateDocumentoEmpresaInput = z.infer<typeof CreateDocumentoEmpresaSchema>;
export type UpdateDocumentoEmpresaInput = z.infer<typeof UpdateDocumentoEmpresaSchema>;
export type CreateFuncionarioInput = z.infer<typeof CreateFuncionarioSchema>;
export type UpdateFuncionarioInput = z.infer<typeof UpdateFuncionarioSchema>;
export type CreateFuncionarioAnexoInput = z.infer<typeof CreateFuncionarioAnexoSchema>;
export type UpdateFuncionarioAnexoInput = z.infer<typeof UpdateFuncionarioAnexoSchema>;

// --- EPI e ausências (migração 052) ---

export const CreateEpiSchema = z.object({
  item: z.string().trim().min(1, "Informe o EPI."),
  ca: TextoOpcional,
  quantidade: z.number().positive("Quantidade precisa ser maior que zero.").optional().default(1),
  data_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de entrega."),
  data_devolucao: Data,
  observacao: TextoOpcional,
});
export const UpdateEpiSchema = CreateEpiSchema.partial();

export const CreateAusenciaSchema = z
  .object({
    tipo: z.enum(["ferias", "atestado", "afastamento", "folga", "outro"]),
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o início."),
    fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o fim."),
    observacao: TextoOpcional,
  })
  .refine((a) => a.fim >= a.inicio, { message: "O fim não pode ser antes do início.", path: ["fim"] });

// --- Listas do RH (Configurações) ---

const IdLista = z.string().trim().min(1);
const Meses = z.number().int().positive().max(240).nullable();
export const ConfigRhSchema = z.object({
  rh_tipos_documento: z
    .array(z.object({ id: IdLista, nome: z.string().trim().min(1, "Todo tipo de documento precisa de nome."), validade_meses: Meses }))
    .optional(),
  rh_documentos_obrigatorios: z
    .array(
      z.object({
        id: IdLista,
        nome: z.string().trim().min(1, "Todo documento obrigatório precisa de nome."),
        categoria: z.enum(["juridico", "fiscal", "sst", "contratos", "outros"]),
        validade_meses: Meses,
      })
    )
    .optional(),
});
