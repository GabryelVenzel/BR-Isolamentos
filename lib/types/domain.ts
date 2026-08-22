// Ponto único de import para tipos de domínio. Os tipos das entidades já
// existentes (Cliente, Orçamento, ConfigEmpresa, ...) continuam declarados em
// `lib/types.ts` — hoje re-exportados aqui só para não duplicar — e os tipos
// dos módulos futuros do ERP (ainda sem tabela no banco) são declarados
// diretamente neste arquivo como scaffolding, para o time inteiro (mesmo que
// hoje seja um dev só) já enxergar o contrato de dados esperado.
//
// Ao criar a tabela real de um desses módulos no Supabase, mover o tipo daqui
// para dentro do respectivo `lib/contexts/<modulo>.ts` (junto das funções que o
// usam) e deixar aqui só um re-export, seguindo o padrão do bloco abaixo.

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

// --- Módulo Comercial (CRM/funil de leads) — planejado ---
// SQL das tabelas `leads`/`interacoes_lead` já existe em
// sql-migration-004-6modulos-completo.sql (ainda precisa ser aplicado no
// Supabase); falta o repositório/use cases para o módulo sair do scaffolding
// em lib/contexts/comercial.ts.

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
  created_at: string;
  updated_at: string;
}

export type TipoInteracaoLead = "nota" | "email" | "chamada" | "reuniao" | "proposta_enviada";

/** Um registro na timeline de um lead (ver `interacoes_lead`). */
export interface InteracaoLead {
  id: string;
  lead_id: string;
  tipo: TipoInteracaoLead;
  descricao: string;
  autor_email: string | null;
  data_interacao: string;
  created_at: string;
}

// --- Módulo Operacional (parceiros/agenda de instalação) — planejado ---
// SQL das tabelas `parceiros`/`agendamentos` já existe em
// sql-migration-004-6modulos-completo.sql; falta o repositório/use cases.

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
}

// --- Módulo Financeiro (contas a pagar/receber) — planejado ---
// SQL das tabelas `lancamentos_financeiros`/`custos_fixos`/`notas_fiscais` já
// existe em sql-migration-004-6modulos-completo.sql; falta o repositório/use
// cases. IMPORTANTE: este módulo nunca recalcula imposto — o imposto de um
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
