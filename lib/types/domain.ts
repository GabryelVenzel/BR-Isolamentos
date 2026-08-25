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

/** Lista fixa de origens — escolhida na criação do lead (dropdown, não mais
 * texto livre) e IMUTÁVEL depois de criado (ver UpdateLeadSchema em
 * lib/validators/lead.ts, que não aceita `origem` no corpo do PATCH). A
 * coluna `leads.origem` continua `varchar` livre no banco — a restrição é só
 * no app (CreateLeadSchema), não uma constraint de banco; leads antigos
 * criados antes desta lista existir podem ter valores fora dela, e não são
 * migrados retroativamente. */
export const ORIGENS_LEAD = ["Site", "LinkedIn", "Indicação", "Evento", "Cold Call"] as const;
export type OrigemLead = (typeof ORIGENS_LEAD)[number];

export interface Lead {
  id: string;
  /** Código único auto-gerado (L00001, L00002, ...) — ver
   * sql-migration-008-operacional-servicos.sql. Base da rastreabilidade
   * Lead→Orçamento→Serviço. */
  numero_lead: string | null;
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
  /** Orçamento vinculado — obrigatório para mover o lead pra etapa
   * "proposta" (ver lib/usecases/comercial/moverLead.ts). Quando vinculado,
   * `valor_estimado` passa a refletir `orcamento.valor_final`. */
  orcamento_id: number | null;
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
  orcamento?: Orcamento;
  // Campos CALCULADOS, não persistidos — anexados por
  // lib/usecases/comercial/prazoEtapa.ts a partir de historico_mudancas_leads
  // + ConfigPrazoEtapas (ver createComercialContext#listarLeads). Ausentes
  // em qualquer outro caminho que não passe por lá (ex.: buscarLead).
  dias_na_etapa_atual?: number;
  etapa_atrasada?: boolean;
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
  | "reativacao_automatica"
  | "vinculo_orcamento";

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
  /** Texto livre — só preenchido em eventos que não cabem nas colunas de
   * etapa/temperatura (hoje só "vinculo_orcamento": "Orçamento O00001
   * vinculado."). */
  descricao: string | null;
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

/** Prazo máximo (em dias) que um lead pode ficar em cada etapa antes de ser
 * considerado "atrasado" — linha única (id fixo = 1), editável na aba
 * Configurações. NÃO confundir com `ConfigReativacaoLeadsFrios`: aquele é o
 * prazo de RETORNO de um lead frio; este é o prazo de PERMANÊNCIA aceitável
 * em cada etapa, para qualquer lead (independente de temperatura). Etapas
 * terminais (fechado/perdido) não têm prazo. */
export interface ConfigPrazoEtapas {
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

// --- Módulo Operacional (parceiros/fornecedores/agenda/serviços) — ver lib/contexts/operacional.ts ---

/** Tipos de trabalho fixos do módulo Operacional — NÃO confundir com
 * `TipoTrabalho` (lib/types.ts: "quente"|"frio"|"misto", classificação
 * térmica do orçamento). Este é o tipo de SERVIÇO/mão de obra executado
 * (bancada, caldeiraria, isolamentos removíveis/fixos). */
export type TipoTrabalhoOperacional = "bancada" | "caldeiraria" | "isolamentos_removiveis" | "isolamentos_fixos";

export interface Parceiro {
  id: string;
  numero_parceiro: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cpf: string | null;
  conta_bancaria: string | null;
  especialidades: string[];
  disponibilidade_horas_semana: number | null;
  disponibilidade_dias: string[];
  custo_hora: number | null;
  // Campos novos (ver sql-migration-008-operacional-servicos.sql) — modelo de
  // capacidade por HEADCOUNT (pessoas), usado pela aba Serviços/Capacidade.
  // Os campos acima (especialidades/custo_hora/disponibilidade_horas_semana)
  // continuam existindo e alimentando o modelo antigo por HORAS, usado pelo
  // dashboard Resumo (v_capacidade_parceiros) — os dois modelos coexistem.
  tipos_trabalho: TipoTrabalhoOperacional[];
  notas_bancada: string | null;
  notas_caldeiraria: string | null;
  notas_isolamentos_removiveis: string | null;
  notas_isolamentos_fixos: string | null;
  /** Capacidade total de pessoas do parceiro. "Mobilizadas"/"disponíveis"
   * NÃO são colunas — são calculadas por dia a partir dos serviços ativos
   * (ver lib/usecases/operacional/capacidade.ts), porque dependem de QUAL
   * DIA está sendo consultado. */
  total_pessoas: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Fornecedor de materiais/equipamentos/serviços (não confundir com
 * `Parceiro`, que é mão de obra de instalação). */
export interface Fornecedor {
  id: string;
  numero_fornecedor: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  tipo_fornecimento: "materiais" | "equipamentos" | "servicos" | null;
  especialidade: string | null;
  notas: string | null;
  pessoa_contato: string | null;
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

export type EtapaServico = "planejamento" | "execucao" | "finalizado";

/** Uma obra/serviço executado — o elo final da rastreabilidade
 * Lead (L00001) → Orçamento (O00001) → Serviço (S00001). Criado a partir de
 * um lead movido para "Fechado" (ver NovoServicoModal.tsx). */
export interface Servico {
  id: string;
  numero_servico: string;
  lead_id: string | null;
  numero_lead: string | null;
  orcamento_id: number | null;
  numero_orcamento: string | null;
  cliente_id: number | null;
  etapa: EtapaServico;
  /** @deprecated espelho do primeiro item de `tipos_trabalho` — mantido só
   * pra não quebrar filtros/relatórios que ainda agrupam por 1 tipo (ver
   * sql-migration-011-servicos-multiplos-tipos.sql). Usar `tipos_trabalho`. */
  tipo_trabalho: TipoTrabalhoOperacional | null;
  /** Um serviço pode ter mais de um tipo de trabalho executado ao mesmo
   * tempo (ex.: Caldeiraria + Isolamentos no mesmo local/dia). */
  tipos_trabalho: TipoTrabalhoOperacional[];
  valor_orcado: number | null;
  /** Preenchido só na finalização — base da análise "real vs orçado". */
  valor_real: number | null;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  data_fim_real: string | null;
  parceiro_principal_id: string | null;
  /** Quantas pessoas do parceiro principal estão alocadas neste serviço —
   * base do cálculo de capacidade por dia (ver
   * lib/usecases/operacional/capacidade.ts). */
  pessoas_alocadas: number | null;
  /** Parceiros de apoio (sem headcount individual — ver decisão 3 em
   * sql-migration-008-operacional-servicos.sql). */
  parceiros_alocados: string[];
  descricao: string | null;
  notas: string | null;
  foto_principal_url: string | null;
  fotos_url: string[];
  pdf_relatorio_url: string | null;
  responsavel_email: string | null;
  created_at: string;
  updated_at: string;
  // Preenchidos via join, opcionais (ver ServicoRepository.select).
  cliente?: Cliente;
  parceiro_principal?: Parceiro;
}

export type TipoEventoServico = "criacao" | "mudanca_etapa" | "anexo_adicionado" | "finalizacao";

/** Timeline de mudanças de etapa/anexos de um serviço (mesma ideia de
 * `HistoricoMudancaLead` no módulo Comercial). */
export interface HistoricoServico {
  id: string;
  servico_id: string;
  tipo_evento: TipoEventoServico;
  etapa_anterior: EtapaServico | null;
  etapa_nova: EtapaServico | null;
  descricao: string | null;
  usuario_email: string | null;
  data_evento: string;
  created_at: string;
}

export type TipoInteracaoServico = "nota" | "foto" | "chamada" | "email" | "reuniao";

/** Timeline de contatos/notas de um serviço (mesma ideia de `InteracaoLead`). */
export interface InteracaoServico {
  id: string;
  servico_id: string;
  tipo: TipoInteracaoServico;
  descricao: string;
  autor_email: string | null;
  data_interacao: string;
  created_at: string;
}

// --- Módulo Financeiro (caixa) — ver lib/contexts/financeiro.ts ---
// IMPORTANTE: este módulo nunca recalcula imposto — o imposto de um
// orçamento já foi calculado e gravado em `orcamentos.detalhamento_impostos`
// na hora da venda (ver lib/tributos.ts); aqui só se registra o fluxo de caixa.

export type TipoLancamentoFinanceiro = "receita" | "despesa";

/** Status de validação de um anexo por IA (feature futura — só a estrutura
 * de dado existe, ver sql-migration-009-financeiro-completo.sql decisão 4).
 * "pending" é o valor de todo anexo hoje, porque nada roda a validação
 * ainda. */
export type StatusValidacaoAnexo = "pending" | "coherent" | "inconsistent" | "error";

/** Um PDF anexado a um lançamento — array em `lancamentos_financeiros.anexos`
 * (jsonb), não um bucket de linhas próprias: um lançamento tem no máximo 5
 * anexos, não justifica uma tabela relacional à parte. */
export interface AnexoLancamento {
  url: string;
  nome: string;
  tamanho: number;
  statusValidacao: StatusValidacaoAnexo;
  notasValidacao: string | null;
}

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
  /** @deprecated Um único arquivo — substituído por `anexos` (múltiplos).
   * Mantido no schema/tipo por compatibilidade com dados antigos; a UI não
   * escreve mais aqui. */
  arquivo_url: string | null;
  anexos: AnexoLancamento[];
  servico_id: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
  // Preenchido via join, opcional (ver LancamentoFinanceiroRepository.select).
  orcamento?: Orcamento;
}

export type StatusHistoricoCustoFixo = "pendente" | "pago" | "atrasado";

/** Um registro no ledger de pagamentos de um custo fixo, um por mês — ver
 * lib/usecases/financeiro/marcarCustoFixoPago.ts. */
export interface HistoricoCustoFixo {
  id: string;
  custo_fixo_id: string;
  data_prevista: string;
  data_pagamento: string | null;
  valor: number;
  status: StatusHistoricoCustoFixo;
  lancamento_id: string | null;
  created_at: string;
}

/** Despesa recorrente mensal (aluguel, energia, ...) — ver seed em
 * sql-migration-004-6modulos-completo.sql. */
export interface CustoFixo {
  id: string;
  categoria: string;
  descricao: string;
  valor_mensal: number;
  /** Dia do mês (1-31) em que o custo normalmente é pago — base do cálculo
   * de "próximo pagamento" (lib/usecases/financeiro/custoFixo.ts). Pode ser
   * `null` em custos antigos criados antes deste campo existir. */
  dia_mes: number | null;
  notas: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Categoria centralizada de lançamento (aba Categorias) — `nome` é o valor
 * de fato gravado em `lancamentos_financeiros.categoria`/`custos_fixos.categoria`
 * (texto livre, não uma FK — ver decisão 2 na migração 009). */
export interface CategoriaLancamento {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: TipoLancamentoFinanceiro;
  cor: string | null;
  ativo: boolean;
  /** Categorias pré-definidas (seed) — não podem ser excluídas, só
   * desativadas. */
  protegida: boolean;
  created_at: string;
  updated_at: string;
}

/** Configuração do ciclo financeiro (aba Configurações) — linha única
 * (id fixo = 1). `dia_inicio_ciclo` ainda não é usado pelos cálculos
 * existentes (continuam no calendário civil) — ver decisão na migração 009. */
export interface ConfigFinanceiro {
  id: number;
  dia_inicio_ciclo: number;
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
