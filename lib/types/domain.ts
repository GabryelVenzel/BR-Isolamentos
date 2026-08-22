// Ponto único de import para tipos de domínio. Os tipos das entidades já
// existentes (Cliente, Orçamento, ConfigEmpresa, ...) continuam declarados em
// `lib/types.ts` — hoje re-exportados aqui só para não duplicar. Os tipos dos
// módulos Comercial/Operacional/Financeiro (tabelas criadas em
// sql-migration-004-6modulos-completo.sql) também vivem aqui, junto do
// restante do domínio, em vez de dentro de cada `lib/contexts/<modulo>.ts` —
// mantido assim (e não movido, como o comentário antigo sugeria) porque não
// há ganho real em espalhar os tipos por vários arquivos agora que os 3
// módulos estão implementados.

// Import "normal" (não só `export type {} from`) para os dois tipos usados
// como relação opcional (`cliente?`, `orcamento?`) mais abaixo neste arquivo —
// um `export type { X } from "y"` não traz `X` para o escopo local do módulo.
import type { Cliente, Orcamento } from "../types";

export type {
  Acabamento,
  CalcularOrcamentoInput,
  CalcularOrcamentoResultado,
  CalcularTermicoInput,
  CalcularTermicoResultadoFrio,
  CalcularTermicoResultadoQuente,
  Cliente,
  CombustivelTipo,
  ConfigEmpresa,
  Geometria,
  ImpostoConfig,
  ItemDetalhamentoImposto,
  ItemOrcamento,
  MaterialIsolante,
  Orcamento,
  PrecoConfig,
  QuantificarInput,
  QuantificarResultado,
  RegimeTributario,
  Role,
  StatusOrcamento,
  TipoMaterialPreco,
  TipoTrabalho,
  Usuario,
} from "../types";

// --- Módulo Comercial (CRM/funil de leads) — ver lib/contexts/comercial.ts ---

export type EtapaFunil = "prospeccao" | "contato" | "proposta" | "negociacao" | "fechado" | "perdido";
export type TemperaturaLead = "frio" | "morno" | "quente";

export interface Lead {
  id: string;
  cliente_id: number;
  etapa: EtapaFunil;
  temperatura: TemperaturaLead;
  valor_estimado: number;
  /** Canal de origem do lead (ex.: "indicação", "site", "feira") — texto livre. */
  origem: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  notas: string | null;
  /** E-mail (`usuarios.email`) do responsável pelo lead. */
  atribuido_a: string | null;
  tags: string[];
  /** Valor de `etapa`/`temperatura` imediatamente antes da última mudança —
   * espelha o topo de `historico_mudancas_leads` sem precisar de um join,
   * usado no card do Kanban ("veio de Contato"). A fonte de verdade completa
   * (toda a sequência de mudanças) é o histórico, não estes dois campos. */
  etapa_anterior: EtapaFunil | null;
  temperatura_anterior: TemperaturaLead | null;
  /** Carimbo da interação mais recente (nota, ligação, e-mail...) — mantido
   * por `lib/usecases/comercial/registrarInteracao.ts`. Base do relatório
   * "leads dormindo" (sem interação há 7+ dias). */
  data_ultima_interacao: string | null;
  created_at: string;
  updated_at: string;
  // Preenchido via join, opcional (ver LeadRepository.select).
  cliente?: Cliente;
}

export type TipoInteracaoLead = "nota" | "email" | "chamada" | "reuniao" | "proposta_enviada";

/** Um registro na timeline de contatos de um lead (ver `interacoes_lead`) —
 * não confundir com `HistoricoMudancaLead`, que registra mudança de
 * etapa/temperatura, não contato. */
export interface InteracaoLead {
  id: string;
  lead_id: string;
  tipo: TipoInteracaoLead;
  descricao: string;
  autor_email: string | null;
  data_interacao: string;
  created_at: string;
}

export type TipoMudancaLead =
  | "criacao"
  | "mudanca_etapa"
  | "mudanca_temperatura"
  | "reativacao_manual"
  | "reativacao_automatica";

/** Um registro na timeline de mudanças de etapa/temperatura de um lead (ver
 * `historico_mudancas_leads`) — o "caminho do lead" exibido no
 * LeadDetailModal. */
export interface HistoricoMudancaLead {
  id: string;
  lead_id: string;
  tipo_mudanca: TipoMudancaLead;
  etapa_anterior: EtapaFunil | null;
  etapa_nova: EtapaFunil | null;
  temperatura_anterior: TemperaturaLead | null;
  temperatura_nova: TemperaturaLead | null;
  data_mudanca: string;
  usuario_email: string | null;
  created_at: string;
}

export type StatusAgendamentoLeadFrio = "agendado" | "reativado" | "cancelado";

/** Reativação agendada de um lead marcado como "frio" (ver
 * `agendamentos_leads_frios` e lib/usecases/comercial/mudarTemperatura.ts). */
export interface AgendamentoLeadFrio {
  id: string;
  lead_id: string;
  temperatura_anterior: TemperaturaLead | null;
  etapa_anterior: EtapaFunil | null;
  data_agendamento: string;
  data_retorno: string;
  intervalo_dias: number;
  status: StatusAgendamentoLeadFrio;
  motivo_cancelamento: string | null;
  created_at: string;
  reativado_em: string | null;
  // Preenchido via join, opcional (ver AgendamentoLeadFrioRepository.select).
  lead?: Lead;
}

/** Prazos de reativação por etapa em que o lead "esfriou" — linha única (id
 * fixo = 1), editável na aba Configurações do CRM. */
export interface ConfigReativacaoLeadsFrios {
  id: number;
  dias_prospeccao: number;
  dias_contato: number;
  dias_proposta: number;
  dias_negociacao: number;
  updated_at: string;
}

/** Linha da view `v_clientes_resumo` — cliente + métricas agregadas dos
 * leads associados, para a aba "Clientes" do CRM. */
export interface ClienteResumo {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cnpj_cpf: string | null;
  criado_em: string;
  total_leads: number;
  ultima_interacao: string | null;
}

// --- Módulo Operacional (parceiros/agenda) — ver lib/contexts/operacional.ts ---

export interface Parceiro {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cpf: string | null;
  conta_bancaria: string | null;
  especialidades: string[];
  disponibilidade_horas_semana: number | null;
  disponibilidade_dias: string[];
  custo_hora: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type StatusAgendamento = "agendado" | "em_progresso" | "concluido" | "cancelado";

export interface Agendamento {
  id: string;
  orcamento_id: number | null;
  data_inicio: string;
  data_fim: string | null;
  /** IDs de `parceiros` alocados neste agendamento (pode ser mais de um). Sem
   * FK de array no Postgres — integridade garantida pelo use case que grava. */
  parceiros_alocados: string[];
  status: StatusAgendamento;
  local: string | null;
  notas: string | null;
  horas_estimadas: number | null;
  horas_reais: number | null;
  created_at: string;
  updated_at: string;
  // Preenchido via join, opcional (ver AgendamentoRepository.select).
  orcamento?: Orcamento;
}

// --- Módulo Financeiro (caixa) — ver lib/contexts/financeiro.ts ---
// IMPORTANTE: este módulo nunca recalcula imposto — o imposto de um
// orçamento já foi calculado e gravado em `orcamentos.detalhamento_impostos`
// na hora da venda (ver lib/tributos.ts); aqui só se registra o fluxo de caixa.

export type TipoLancamentoFinanceiro = "receita" | "despesa";

export interface LancamentoFinanceiro {
  id: string;
  tipo: TipoLancamentoFinanceiro;
  categoria: string;
  data: string;
  descricao: string;
  valor: number;
  pago: boolean;
  data_pagamento: string | null;
  orcamento_id: number | null;
  arquivo_url: string | null;
  created_at: string;
  updated_at: string;
  // Preenchido via join, opcional (ver LancamentoFinanceiroRepository.select).
  orcamento?: Orcamento;
}

/** Despesa recorrente mensal (aluguel, energia, ...) — ver seed em
 * sql-migration-004-6modulos-completo.sql. */
export interface CustoFixo {
  id: string;
  categoria: string;
  descricao: string;
  valor_mensal: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Nota fiscal de despesa enviada (upload de PDF; extração dos campos por OCR
 * é trabalho futuro — por enquanto `processado` fica `false` até conciliação
 * manual com um `LancamentoFinanceiro`). */
export interface NotaFiscal {
  id: string;
  pdf_url: string;
  fornecedor: string | null;
  cnpj_cpf: string | null;
  numero_nf: string | null;
  serie: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  valor: number | null;
  categoria: string | null;
  processado: boolean;
  lancamento_id: string | null;
  created_at: string;
}
