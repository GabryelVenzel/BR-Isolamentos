import { z } from "zod";
import { ORIGENS_LEAD } from "../types/domain";

// Módulo Comercial (funil de leads) — o SQL já existe em
// sql-migration-004-6modulos-completo.sql (falta aplicar no Supabase e
// implementar o repositório, ver lib/contexts/comercial.ts).

const EtapaFunilSchema = z.enum(["prospeccao", "contato", "proposta", "negociacao", "fechado", "perdido"]);

// Origem passou de texto livre para uma lista fixa (dropdown, ver
// ORIGENS_LEAD em lib/types/domain.ts) — evita variação de grafia
// ("site"/"Site"/"SITE") que antes fragmentava o relatório "Leads por
// Origem". Continua nullable/opcional: nem toda tela força o usuário a
// escolher uma origem no momento da criação.
const OrigemSchema = z.enum(ORIGENS_LEAD);

// Migração 026 — sistema de comissão/indicação: `eh_comissao` liga os campos
// de comissão (parceiro/valor indicado/% comissão) — `valor_comissao` NÃO
// entra aqui, é coluna GERADA pelo banco (ver Lead.valor_comissao), nunca
// aceita do cliente. O `.superRefine` abaixo exige os 3 campos só quando
// `eh_comissao` é true — em lead normal eles continuam opcionais/ausentes.
const CamposBaseLeadSchema = z.object({
  cliente_id: z.number().int().positive(),
  etapa: EtapaFunilSchema,
  temperatura: z.enum(["frio", "morno", "quente"]),
  valor_estimado: z.number().nonnegative(),
  origem: OrigemSchema.nullable().optional(),
  proxima_acao: z.string().trim().nullable().optional(),
  data_proxima_acao: z.string().datetime().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
  atribuido_a: z.string().trim().email().nullable().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  eh_comissao: z.boolean().optional(),
  parceiro_id: z.string().trim().nullable().optional(),
  valor_indicado: z.number().nonnegative().nullable().optional(),
  percentual_comissao: z.number().min(0).max(100).nullable().optional(),
});

// Tipo estrutural mínimo (não `z.infer<typeof CamposBaseLeadSchema>`) pra
// esta função servir tanto o schema cheio (Create) quanto o `.partial()`
// (Update), que tem todo campo opcional — os dois formatos são compatíveis
// com este subconjunto de campos.
interface CamposComissao {
  eh_comissao?: boolean;
  parceiro_id?: string | null;
  valor_indicado?: number | null;
  percentual_comissao?: number | null;
}

function exigirCamposDeComissao(dados: CamposComissao, ctx: z.RefinementCtx) {
  if (!dados.eh_comissao) return;
  if (!dados.parceiro_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parceiro_id"], message: "Selecione o parceiro da indicação." });
  }
  if (!dados.valor_indicado || dados.valor_indicado <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["valor_indicado"], message: "Informe o valor indicado (maior que zero)." });
  }
  if (dados.percentual_comissao == null || dados.percentual_comissao <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentual_comissao"], message: "Informe o % de comissão (entre 0 e 100)." });
  }
}

export const CreateLeadSchema = CamposBaseLeadSchema.superRefine(exigirCamposDeComissao);

// `origem` fica no shape (herdado de CamposBaseLeadSchema) mas é ignorada no
// uso — origem é IMUTÁVEL depois de criado o lead (ver atualizarLead.ts, que
// remove `etapa`, `temperatura` E `origem` antes de gravar). Mantida aqui só
// porque `.partial()` deriva o resto do schema automaticamente; não é um
// campo realmente editável via PATCH. `eh_comissao` também não é mais
// editável depois de criado (ver atualizarLead.ts) — os campos de comissão
// em si (parceiro/valor/%) continuam editáveis via PATCH, por isso o
// `.superRefine` aqui também vale pro update (não dá pra ficar com
// `eh_comissao = true` e um campo obrigatório vazio depois de um PATCH).
export const UpdateLeadSchema = CamposBaseLeadSchema.partial().superRefine(exigirCamposDeComissao);

export const MoverLeadSchema = z.object({
  leadId: z.string().min(1),
  novaEtapa: EtapaFunilSchema,
});

// Vincula um orçamento ao lead — obrigatório antes de mover pra etapa
// "proposta" (ver lib/usecases/comercial/moverLead.ts e
// lib/usecases/comercial/vincularOrcamento.ts). Integração
// Lead→Orçamento→Serviço.
export const VincularOrcamentoSchema = z.object({
  leadId: z.string().min(1),
  orcamentoId: z.number().int().positive("Selecione um orçamento."),
});

// Mudar temperatura é uma operação separada de `atualizarLead` (como mover de
// etapa) porque tem efeito colateral: virar "frio" agenda uma reativação
// automática (ver lib/usecases/comercial/mudarTemperatura.ts). O usuário pode
// informar um prazo customizado (campo "Custom: [___] dias" do mockup) — se
// omitido, o use case usa o prazo configurado para a etapa atual do lead.
const TemperaturaSchema = z.enum(["frio", "morno", "quente"]);

export const MudarTemperaturaSchema = z.object({
  leadId: z.string().min(1),
  novaTemperatura: TemperaturaSchema,
  intervaloDiasCustom: z.number().int().positive("O prazo customizado deve ser maior que zero.").optional(),
});

export const CancelarAgendamentoFrioSchema = z.object({
  motivoCancelamento: z.string().trim().nullable().optional(),
});

export const AtualizarConfigReativacaoSchema = z.object({
  dias_prospeccao: z.number().int().positive("Deve ser maior que zero."),
  dias_contato: z.number().int().positive("Deve ser maior que zero."),
  dias_proposta: z.number().int().positive("Deve ser maior que zero."),
  dias_negociacao: z.number().int().positive("Deve ser maior que zero."),
});

// Mesmo shape de AtualizarConfigReativacaoSchema, schema separado porque são
// duas configurações conceitualmente diferentes (ver ConfigPrazoEtapas em
// lib/types/domain.ts) — não reaproveitar o mesmo schema só porque os campos
// batem seria acoplar duas regras de negócio que podem divergir no futuro.
export const AtualizarConfigPrazoEtapasSchema = z.object({
  dias_prospeccao: z.number().int().positive("Deve ser maior que zero."),
  dias_contato: z.number().int().positive("Deve ser maior que zero."),
  dias_proposta: z.number().int().positive("Deve ser maior que zero."),
  dias_negociacao: z.number().int().positive("Deve ser maior que zero."),
});

export const CreateInteracaoLeadSchema = z.object({
  lead_id: z.string().min(1),
  tipo: z.enum(["nota", "email", "chamada", "reuniao", "proposta_enviada"]),
  descricao: z.string().trim().min(1, "Descreva a interação."),
  autor_email: z.string().trim().email().nullable().optional(),
  data_interacao: z.string().datetime().nullable().optional(),
});

// Upload em si acontece no navegador (Supabase Storage, bucket
// "leads-anexos") — este schema só valida o registro que sobra depois,
// mesmo padrão de AnexarArquivoServicoSchema.
const LIMITE_ANEXO_BYTES = 10 * 1024 * 1024; // 10 MB, conforme pedido
export const CreateAnexoLeadSchema = z.object({
  lead_id: z.string().min(1),
  nome_arquivo: z.string().trim().min(1),
  tipo_arquivo: z.string().trim().min(1),
  tamanho_bytes: z.number().int().positive().max(LIMITE_ANEXO_BYTES, "Arquivo maior que 10 MB."),
  storage_path: z.string().trim().min(1),
  url: z.string().trim().min(1),
  adicionado_por: z.string().trim().email().nullable().optional(),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export type MoverLeadInput = z.infer<typeof MoverLeadSchema>;
export type VincularOrcamentoInput = z.infer<typeof VincularOrcamentoSchema>;
export type MudarTemperaturaInput = z.infer<typeof MudarTemperaturaSchema>;
export type CancelarAgendamentoFrioInput = z.infer<typeof CancelarAgendamentoFrioSchema>;
export type AtualizarConfigReativacaoInput = z.infer<typeof AtualizarConfigReativacaoSchema>;
export type AtualizarConfigPrazoEtapasInput = z.infer<typeof AtualizarConfigPrazoEtapasSchema>;
export type CreateInteracaoLeadInput = z.infer<typeof CreateInteracaoLeadSchema>;
export type CreateAnexoLeadInput = z.infer<typeof CreateAnexoLeadSchema>;
