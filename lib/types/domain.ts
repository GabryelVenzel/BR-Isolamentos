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

// --- Módulo Comercial (CRM/funil de leads) — planejado, tabela ainda não existe ---

export type EtapaFunil = "prospeccao" | "contato" | "proposta" | "negociacao" | "fechado";
export type TemperaturaLead = "frio" | "morno" | "quente";

export interface Lead {
  id: string;
  cliente_id: number;
  etapa: EtapaFunil;
  temperatura: TemperaturaLead;
  valor_estimado: number;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_at: string;
  updated_at: string;
}

// --- Módulo Operacional (parceiros/agenda de instalação) — planejado ---

export interface Parceiro {
  id: string;
  nome: string;
  especialidade: string;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type StatusAgendamento = "planejado" | "confirmado" | "em_execucao" | "concluido" | "cancelado";

export interface Agendamento {
  id: string;
  orcamento_id: number;
  parceiro_id: string;
  data_inicio: string;
  data_fim: string | null;
  status: StatusAgendamento;
  created_at: string;
  updated_at: string;
}

// --- Módulo Financeiro (contas a pagar/receber) — planejado ---

export type TipoItemFinanceiro = "receita" | "despesa";
export type StatusItemFinanceiro = "pendente" | "pago" | "atrasado" | "cancelado";

export interface ItemFinanceiro {
  id: string;
  orcamento_id: number | null;
  tipo: TipoItemFinanceiro;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusItemFinanceiro;
  created_at: string;
  updated_at: string;
}
