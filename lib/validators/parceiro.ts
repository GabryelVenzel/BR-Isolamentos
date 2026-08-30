import { z } from "zod";

// Lista revisada (migração 027) — ver comentário em TipoTrabalhoOperacional
// (lib/types/domain.ts) sobre por que `bancada`/`caldeiraria` preservam a
// chave antiga.
const TipoTrabalhoOperacionalSchema = z.enum([
  "bancada",
  "isolador",
  "funileiro_tracador",
  "caldeiraria",
  "caldeiraria_montagem",
  "removivel_montagem",
  "removivel_fabricacao",
]);

const CategoriaParceiroSchema = z.enum(["prestador", "parceria", "ambos"]);

export const CreateParceiroSchema = z.object({
  // Nome fantasia (migração 031, ver comentário em Parceiro.nome,
  // lib/types/domain.ts) — continua sendo o campo `nome`.
  nome: z.string().trim().min(1, "Informe o nome do parceiro."),
  razao_social: z.string().trim().nullable().optional(),
  email: z.string().trim().email("E-mail inválido.").nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  cnpj: z.string().trim().nullable().optional(),
  endereco: z.string().trim().nullable().optional(),
  // Sigla vem de um dropdown fixo agora (ModalParceiro.tsx) — a validação de
  // tamanho continua como salvaguarda de schema, não porque a UI ainda
  // aceita digitação livre.
  estado: z.string().trim().length(2, "Use a sigla do estado (ex.: SP).").nullable().optional(),
  cpf: z.string().trim().nullable().optional(),
  conta_bancaria: z.string().trim().nullable().optional(),
  // "especialidade" (singular, classificação fixa) NÃO existe em Parceiro —
  // foi movida pra Fornecedor (ver sql-migration-014). Isso aqui embaixo
  // (plural) é o modelo antigo por horas/semana, usado pelo dashboard Resumo.
  especialidades: z.array(z.string().trim().min(1)).optional(),
  disponibilidade_horas_semana: z.number().nonnegative().nullable().optional(),
  disponibilidade_dias: z.array(z.string().trim().min(1)).optional(),
  custo_hora: z.number().nonnegative().nullable().optional(),
  // Pelo menos um tipo de trabalho, conforme o pedido — mas só exigido na
  // CRIAÇÃO (UpdateParceiroSchema é .partial(), então uma edição parcial que
  // não mexe nesse campo não é bloqueada).
  tipos_trabalho: z.array(TipoTrabalhoOperacionalSchema).min(1, "Selecione pelo menos um tipo de trabalho."),
  // Default "prestador" (migração 027) — mesmo raciocínio do default de
  // banco: todo parceiro sem essa informação explícita é tratado como quem
  // já era até aqui, fornecedor de mão de obra.
  categoria_parceiro: CategoriaParceiroSchema.optional().default("prestador"),
  notas_bancada: z.string().trim().nullable().optional(),
  notas_caldeiraria: z.string().trim().nullable().optional(),
  // Migração 030 — faltavam notas pras 5 categorias novas da migração 027.
  notas_isolador: z.string().trim().nullable().optional(),
  notas_funileiro_tracador: z.string().trim().nullable().optional(),
  notas_caldeiraria_montagem: z.string().trim().nullable().optional(),
  notas_removivel_montagem: z.string().trim().nullable().optional(),
  notas_removivel_fabricacao: z.string().trim().nullable().optional(),
  notas_isolamentos_removiveis: z.string().trim().nullable().optional(),
  notas_isolamentos_fixos: z.string().trim().nullable().optional(),
  total_pessoas: z.number().int().positive("Total de pessoas deve ser maior que zero.").nullable().optional(),
  ativo: z.boolean().optional(),
});

export const UpdateParceiroSchema = CreateParceiroSchema.partial();

// Anexo de parceiro (Editar Parceiro → seção Anexos) — mesmo padrão de
// CreateAnexoLeadSchema, limite de 20 MB (maior que o de Lead: pedido
// explícito pra este caso, documentação de parceiro tende a ter apólices/
// certidões digitalizadas maiores).
const LIMITE_ANEXO_PARCEIRO_BYTES = 20 * 1024 * 1024;

export const CreateParceiroAnexoSchema = z.object({
  parceiro_id: z.string().min(1),
  nome_arquivo: z.string().trim().min(1),
  tipo_arquivo: z.string().trim().min(1),
  tamanho_bytes: z.number().int().positive().max(LIMITE_ANEXO_PARCEIRO_BYTES, "Arquivo maior que 20 MB."),
  storage_path: z.string().trim().min(1),
  url: z.string().trim().min(1),
  adicionado_por: z.string().trim().email().nullable().optional(),
});

export type CreateParceiroInput = z.infer<typeof CreateParceiroSchema>;
export type UpdateParceiroInput = z.infer<typeof UpdateParceiroSchema>;
export type CreateParceiroAnexoInput = z.infer<typeof CreateParceiroAnexoSchema>;
