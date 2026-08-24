import { z } from "zod";

const TipoTrabalhoSchema = z.enum(["quente", "frio", "misto"]);
const GeometriaSchema = z.enum(["plana", "tubulacao"]);
const StatusOrcamentoSchema = z.enum(["rascunho", "proposta", "enviado", "aceito", "rejeitado"]);

/** Um trecho técnico do orçamento (ver `ItemOrcamento` em `lib/types.ts`). Os
 * campos numéricos calculados (espessura, perdas, quantificação...) são
 * validados apenas quanto ao tipo — o valor em si vem do motor de cálculo
 * (`lib/calculadora-termica.ts` / `lib/quantificador.ts`), não do usuário. */
const ItemEscopoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  tipo: z.enum(["tubulacao", "curva", "plano"]),
  diametro_mm: z.number().nullable(),
  comprimento_m: z.number().nullable(),
  quantidade: z.number().nullable(),
  metragem_manual_m2: z.number().nullable(),
  metragem_editada: z.boolean(),
});

export const ItemOrcamentoSchema = z.object({
  ordem: z.number().int().nonnegative(),
  tipo_trabalho: TipoTrabalhoSchema,
  // Escopo (migração 010) — itens que compõem a metragem do trecho. Default
  // `[]` mantém compatibilidade com qualquer chamador antigo que ainda não
  // manda esse campo.
  escopo_itens: z.array(ItemEscopoSchema).optional().default([]),
  material: z.string().min(1),
  acabamento: z.string().nullable().optional(),
  especificacao_isolante: z.string().nullable().optional(),
  especificacao_acabamento: z.string().nullable().optional(),
  temperatura_quente: z.number(),
  temperatura_ambiente: z.number(),
  umidade_relativa: z.number().nullable().optional(),
  velocidade_vento: z.number().nullable().optional(),
  geometria: GeometriaSchema,
  diametro_mm: z.number().positive().nullable().optional(),
  area_m2: z.number().positive("A área precisa ser maior que zero."),
  perimetro_m: z.number().nullable().optional(),
  espessura_necessaria_mm: z.number(),
  temperatura_face_fria: z.number().nullable().optional(),
  perda_com_isolante: z.number(),
  perda_sem_isolante: z.number(),
  economia_anual: z.number().nullable().optional(),
  co2_ton_ano: z.number().nullable().optional(),
  // Método Expert em kg — só orçamentos anteriores à migração 010 preenchem.
  manta_kg: z.number().nullable().optional(),
  chapa_kg: z.number().nullable().optional(),
  rebites: z.number().nullable().optional(),
  parafusos: z.number().nullable().optional(),
  arame_kg: z.number().nullable().optional(),
  vedacao_pu: z.number().nullable().optional(),
  vedacit_un: z.number().nullable().optional(),
  // Precificação por m² (migração 010).
  preco_isolante_m2: z.number().nullable().optional(),
  preco_acabamento_m2: z.number().nullable().optional(),
  horas_mao_obra: z.number().nonnegative().optional().default(0),
  subtotal_material: z.number().nonnegative().optional().default(0),
  subtotal_mao_obra: z.number().nonnegative().optional().default(0),
  valor_materiais: z.number().nonnegative(),
});

export const CreateOrcamentoSchema = z.object({
  cliente_id: z.number().int().positive("Orçamento sem cliente vinculado."),
  tipo_trabalho: TipoTrabalhoSchema,
  itens: z.array(ItemOrcamentoSchema).min(1, "Orçamento precisa de ao menos um item/trecho."),
  valor_materiais: z.number().nonnegative(),
  valor_mao_obra: z.number().nonnegative(),
  valor_deslocamento: z.number().nonnegative(),
  valor_hospedagem: z.number().nonnegative(),
  valor_frete: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  detalhamento_impostos: z.array(z.object({ nome: z.string(), percentual: z.number(), valor: z.number() })),
  total_impostos: z.number().nonnegative(),
  margem_lucro: z.number(),
  valor_desconto: z.number().nonnegative(),
  preco_cheio: z.number().nonnegative(),
  valor_final: z.number().nonnegative(),
  status: StatusOrcamentoSchema.optional(),
});

export const UpdateOrcamentoSchema = CreateOrcamentoSchema.partial();

export type CreateOrcamentoInput = z.infer<typeof CreateOrcamentoSchema>;
export type UpdateOrcamentoInput = z.infer<typeof UpdateOrcamentoSchema>;
