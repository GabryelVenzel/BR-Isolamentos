import { z } from "zod";

// Compras e diárias (migração 044).

const DataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const Uuid = z.string().uuid("Identificador inválido.");

const ItemPedidoSchema = z.object({
  descricao: z.string().trim().min(1, "Descreva o item."),
  unidade: z.string().trim().min(1, "Informe a unidade.").max(20),
  quantidade: z.number().positive("A quantidade precisa ser maior que zero."),
  preco_unitario: z.number().nonnegative("O preço não pode ser negativo."),
  preco_config_id: z.number().int().positive().nullable().optional(),
});

export const SalvarPedidoCompraSchema = z.object({
  fornecedor_id: Uuid,
  servico_id: Uuid.nullable().optional(),
  cotacao_id: Uuid.nullable().optional(),
  data_pedido: DataISO,
  previsao_entrega: DataISO.nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
  itens: z.array(ItemPedidoSchema).min(1, "Inclua pelo menos um item no pedido."),
});

export const AcaoPedidoCompraSchema = z.object({
  acao: z.enum(["enviar", "cancelar", "reabrir"]),
});

/** Receber o pedido gera a conta a pagar — estes são os dados dela. */
export const ReceberPedidoCompraSchema = z.object({
  data_recebimento: DataISO,
  categoria: z.string().trim().min(1, "Selecione a categoria da despesa."),
  vencimento: DataISO,
  forma_pagamento: z.enum(["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"]).nullable().optional(),
  parcelas: z.number().int().min(1).max(60).default(1),
  /** Não gerar conta a pagar (ex.: já foi lançada à mão). */
  sem_lancamento: z.boolean().default(false),
});

const ItemCotacaoSchema = z.object({
  id: z.string().min(1),
  descricao: z.string().trim().min(1, "Descreva o item."),
  unidade: z.string().trim().min(1).max(20),
  quantidade: z.number().positive("A quantidade precisa ser maior que zero."),
});

export const SalvarCotacaoSchema = z.object({
  titulo: z.string().trim().min(1, "Dê um título à cotação."),
  servico_id: Uuid.nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
  itens: z.array(ItemCotacaoSchema).min(1, "Inclua pelo menos um item na cotação."),
});

export const SalvarPropostaCotacaoSchema = z.object({
  fornecedor_id: Uuid,
  precos: z.record(z.string(), z.number().nonnegative()),
  prazo_entrega_dias: z.number().int().nonnegative().nullable().optional(),
  condicao_pagamento: z.string().trim().nullable().optional(),
  observacoes: z.string().trim().nullable().optional(),
});

export const GerarPedidoDaCotacaoSchema = z.object({ proposta_id: Uuid });

export const CreateDiariaSchema = z
  .object({
  // Quem trabalhou: um parceiro OU um funcionário (exatamente um).
  parceiro_id: Uuid.nullable().optional(),
  funcionario_id: Uuid.nullable().optional(),
  data: DataISO,
  periodo: z.enum(["manha", "tarde", "noite", "integral"]),
  pessoas: z.number().int().positive("Informe quantas pessoas trabalharam."),
  funcao: z.string().trim().nullable().optional(),
  valor: z.number().nonnegative("O valor não pode ser negativo."),
  observacoes: z.string().trim().nullable().optional(),
  })
  .refine((d) => Boolean(d.parceiro_id) !== Boolean(d.funcionario_id), "Selecione um parceiro ou um funcionário.");

export const AlocarFuncionarioSchema = z.object({
  funcionario_id: Uuid,
  tipos_trabalho: z
    .array(z.enum(["bancada", "isolador", "funileiro_tracador", "caldeiraria", "caldeiraria_montagem", "removivel_montagem", "removivel_fabricacao", "ajudante"]))
    .min(1, "Selecione pelo menos uma função."),
});

export const ValidadeAnexoSchema = z.object({ validade: DataISO.nullable() });
