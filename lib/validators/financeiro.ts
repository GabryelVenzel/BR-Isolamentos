import { z } from "zod";

// Anexo de lançamento — array de objetos (não texto puro), pra já carregar o
// espaço reservado pra validação por IA no futuro (status_validacao/
// notas_validacao ficam null/"pending" até essa feature existir — ver
// sql-migration-009-financeiro-completo.sql decisão 4). O upload em si
// acontece no navegador (Supabase Storage), este schema só valida os
// metadados que chegam depois do upload.
const AnexoLancamentoSchema = z.object({
  url: z.string().trim().min(1),
  nome: z.string().trim().min(1),
  tamanho: z.number().nonnegative(),
  statusValidacao: z.enum(["pending", "coherent", "inconsistent", "error"]).default("pending"),
  notasValidacao: z.string().trim().nullable().optional(),
});

const FormaPagamentoSchema = z.enum(["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"]);
const DataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

// Campos gravados em `lancamentos_financeiros`.
const CamposLancamento = {
  tipo: z.enum(["receita", "despesa"]),
  categoria: z.string().trim().min(1, "Informe a categoria."),
  /** Vencimento. */
  data: DataISO,
  /** Competência (migração 041) — se omitida, o banco usa a do vencimento. */
  data_competencia: DataISO.optional(),
  forma_pagamento: FormaPagamentoSchema.nullable().optional(),
  fornecedor_id: z.string().uuid().nullable().optional(),
  parceiro_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(1, "Descreva o lançamento."),
  valor: z.number().positive("O valor precisa ser maior que zero."),
  pago: z.boolean().optional(),
  data_pagamento: z.string().nullable().optional(),
  orcamento_id: z.number().int().positive().nullable().optional(),
  servico_id: z.string().trim().nullable().optional(),
  lead_id: z.string().trim().nullable().optional(),
  arquivo_url: z.string().trim().nullable().optional(),
  anexos: z.array(AnexoLancamentoSchema).max(5, "Máximo de 5 anexos por lançamento.").optional(),
};

/** Criação: além dos campos do lançamento, aceita gerar vários de uma vez —
 * `parcelas` (divide o valor em N vencimentos mensais) OU `repetir_meses`
 * (repete o valor cheio por N meses). Ver lib/financeiro.ts. */
export const CreateLancamentoSchema = z
  .object({
    ...CamposLancamento,
    parcelas: z.number().int().min(2, "Parcelamento precisa de pelo menos 2 parcelas.").max(60, "Máximo de 60 parcelas.").optional(),
    repetir_meses: z.number().int().min(2, "A repetição precisa de pelo menos 2 meses.").max(60, "Máximo de 60 meses.").optional(),
  })
  .refine((d) => !(d.parcelas && d.repetir_meses), "Escolha parcelar OU repetir, não os dois.");

export const UpdateLancamentoSchema = z.object(CamposLancamento).partial();

export const CreateCustoFixoSchema = z.object({
  categoria: z.string().trim().min(1, "Informe a categoria."),
  descricao: z.string().trim().min(1, "Descreva o custo fixo."),
  valor_mensal: z.number().nonnegative(),
  dia_mes: z.number().int().min(1, "Dia do mês deve estar entre 1 e 31.").max(31, "Dia do mês deve estar entre 1 e 31."),
  notas: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const UpdateCustoFixoSchema = CreateCustoFixoSchema.partial();

// Prazo de pagamento pode ser customizado (o usuário paga num dia diferente
// do previsto) — se omitido, usa a data de hoje (Brasília).
export const MarcarCustoFixoPagoSchema = z.object({
  dataPagamento: z.string().nullable().optional(),
});

export const CreateCategoriaLancamentoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da categoria."),
  descricao: z.string().trim().nullable().optional(),
  tipo: z.enum(["receita", "despesa"]),
  cor: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
});

// `protegida` não é editável pelo usuário — só o seed define isso (ver
// migração 009). Categorias criadas na tela nunca nascem protegidas.
export const UpdateCategoriaLancamentoSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  descricao: z.string().trim().nullable().optional(),
  tipo: z.enum(["receita", "despesa"]).optional(),
  cor: z.string().trim().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const AtualizarConfigFinanceiroSchema = z.object({
  dia_inicio_ciclo: z.number().int().min(1).max(28),
});

export type CreateLancamentoInput = z.infer<typeof CreateLancamentoSchema>;
export type UpdateLancamentoInput = z.infer<typeof UpdateLancamentoSchema>;
export type CreateCustoFixoInput = z.infer<typeof CreateCustoFixoSchema>;
export type UpdateCustoFixoInput = z.infer<typeof UpdateCustoFixoSchema>;
export type MarcarCustoFixoPagoInput = z.infer<typeof MarcarCustoFixoPagoSchema>;
export type CreateCategoriaLancamentoInput = z.infer<typeof CreateCategoriaLancamentoSchema>;
export type UpdateCategoriaLancamentoInput = z.infer<typeof UpdateCategoriaLancamentoSchema>;
export type AtualizarConfigFinanceiroInput = z.infer<typeof AtualizarConfigFinanceiroSchema>;
