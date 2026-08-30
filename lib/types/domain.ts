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
  /** Migração 026 — sistema de comissão/indicação: um lead marcado como
   * comissão é um lead normal (mesmo funil, mesma timeline, mesmos anexos)
   * que representa uma indicação a um parceiro, não uma venda direta da BR
   * Isolamentos — por isso não precisa de orçamento vinculado (ver
   * `moverLead.ts`: comissão troca a exigência de orçamento por exigência
   * de anexo/comprovante) e, ao fechar, gera um lançamento financeiro de
   * receita automaticamente. */
  eh_comissao: boolean;
  parceiro_id: string | null;
  /** Valor do negócio indicado ao parceiro (base do cálculo da comissão) —
   * `null` em lead normal. */
  valor_indicado: number | null;
  /** 0-100 — `null` em lead normal. */
  percentual_comissao: number | null;
  /** Coluna GERADA pelo banco (`valor_indicado * percentual_comissao / 100`,
   * ver migração 026) — nunca enviar no PATCH/POST, o Postgres calcula
   * sozinho. `null` em lead normal (nunca marcado como comissão). */
  valor_comissao: number | null;
  created_at: string;
  updated_at: string;
  // Preenchido via join, opcional (ver LeadRepository.select).
  cliente?: Cliente;
  orcamento?: Orcamento;
  /** Parceiro pra quem a indicação foi feita — só em lead de comissão. */
  parceiro?: Parceiro;
  // Campos CALCULADOS, não persistidos — anexados por
  // lib/usecases/comercial/prazoEtapa.ts a partir de historico_mudancas_leads
  // + ConfigPrazoEtapas (ver createComercialContext#listarLeads). Ausentes
  // em qualquer outro caminho que não passe por lá (ex.: buscarLead).
  dias_na_etapa_atual?: number;
  etapa_atrasada?: boolean;
  /** Migração 026 — total de anexos do lead, anexado só a leads de comissão
   * (ver createComercialContext#listarLeads) pra alimentar o indicador
   * visual do card do Kanban (✅/⚠️ tem comprovante) sem precisar de outro
   * fetch por lead. `undefined` em qualquer caminho que não passe por lá. */
  total_anexos?: number;
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

/** Documento anexado a um lead (RG/CPF do cliente, contratos, fotos,
 * documentação técnica...) — ver `anexos_lead`, migração 012. Uma linha por
 * arquivo (não um array jsonb): permite excluir/consultar um anexo direto
 * por id. */
export interface AnexoLead {
  id: string;
  lead_id: string;
  nome_arquivo: string;
  /** Extensão/mime simplificado: "pdf", "docx", "xlsx", "jpg"... — usado só
   * pra escolher o ícone na UI, não validado contra uma lista fechada. */
  tipo_arquivo: string;
  tamanho_bytes: number;
  storage_path: string;
  url: string;
  data_adicao: string;
  adicionado_por: string | null;
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
 * térmica do orçamento). Este é o tipo de SERVIÇO/mão de obra executado.
 *
 * Lista revisada (migração 027, corrigida logo em seguida pra incluir
 * `caldeiraria_montagem` — faltava na primeira rodada) — trocou de 4 pra 7
 * categorias. `bancada` e `caldeiraria` são as mesmas chaves de sempre (só o
 * RÓTULO de `caldeiraria` mudou pra "Caldeiraria (Fabricação)"), pra
 * preservar a classificação de parceiros já cadastrados sem precisar migrar
 * dado nenhum. As 2 chaves antigas removidas (`isolamentos_removiveis`/
 * `isolamentos_fixos`) não têm substituto 1:1 nas novas — parceiros que só
 * tinham essas marcadas precisam ser reclassificados manualmente (ver
 * sql-migration-027). */
export type TipoTrabalhoOperacional =
  | "bancada"
  | "isolador"
  | "funileiro_tracador"
  | "caldeiraria"
  | "caldeiraria_montagem"
  | "removivel_montagem"
  | "removivel_fabricacao";

/** Migração 027 — o que um parceiro realmente FORNECE: "prestador" mobiliza
 * gente de verdade (aparece na Agenda/Capacidade, pode ser vinculado a um
 * Serviço); "parceria" é só um canal de indicação (aparece no seletor de
 * comissão do Lead, migração 026, mas nunca na Agenda — não tem headcount
 * pra oferecer); "ambos" entra nos dois fluxos. */
export type CategoriaParceiro = "prestador" | "parceria" | "ambos";

/** Categorias de fornecimento (material/equipamento/serviço de apoio — ver
 * sql-migration-015). Corrige um equívoco da migração 013, que tinha
 * colocado uma classificação parecida em `Parceiro` (mão de obra de
 * instalação) — quem fornece MATERIAL é `Fornecedor`, então é lá que essa
 * classificação faz sentido; `Parceiro` já tem `tipos_trabalho` pra
 * classificação dele. Um fornecedor pode ter MAIS DE UMA categoria ao mesmo
 * tempo (ver `Fornecedor.tipos_fornecimento`, array) — ex.: fornece
 * Isolantes E Ferragens. */
export type CategoriaFornecimento = "isolantes" | "chaparia" | "ferramentas" | "ferragens" | "outros";

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
  /** Migração 027 — ver `CategoriaParceiro`. Default `"prestador"` (todo
   * parceiro cadastrado antes desta migração fornece mão de obra, é
   * exatamente o que ele já fazia). */
  categoria_parceiro: CategoriaParceiro;
  notas_bancada: string | null;
  notas_caldeiraria: string | null;
  /** Migração 030 — faltavam notas pras 5 categorias novas da migração 027
   * (só bancada/caldeiraria tinham ficado). */
  notas_isolador: string | null;
  notas_funileiro_tracador: string | null;
  notas_caldeiraria_montagem: string | null;
  notas_removivel_montagem: string | null;
  notas_removivel_fabricacao: string | null;
  /** @deprecated Tipo de trabalho correspondente removido da lista (migração
   * 027, sem substituto 1:1) — mantido no schema só por compatibilidade com
   * parceiros já cadastrados; a UI não escreve mais aqui. */
  notas_isolamentos_removiveis: string | null;
  /** @deprecated Ver `notas_isolamentos_removiveis`. */
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

/** Documento anexado a um parceiro (contrato, certidão, apólice de seguro...)
 * — mesmo padrão de `AnexoLead`, um arquivo por linha. Editável só na tela de
 * Editar Parceiro (pedido explícito — não faz sentido pedir documentação
 * antes do parceiro nem existir). */
export interface ParceiroAnexo {
  id: string;
  parceiro_id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho_bytes: number;
  storage_path: string;
  url: string;
  data_adicao: string;
  adicionado_por: string | null;
}

/** Um parceiro vinculado a um serviço, com headcount e tipos de trabalho
 * PRÓPRIOS (ver sql-migration-013) — substitui o modelo antigo de "um
 * parceiro principal + parceiros de apoio sem headcount" (`Servico.
 * parceiro_principal_id`/`pessoas_alocadas`/`parceiros_alocados`, mantidos
 * no schema só por compatibilidade com serviços já criados). Um serviço pode
 * ter N linhas destas. */
export interface ServicoParceiroExecucao {
  id: string;
  servico_id: string;
  parceiro_id: string;
  pessoas_mobilizadas: number;
  tipos_trabalho: TipoTrabalhoOperacional[];
  data_adicao: string;
  // Preenchido via join, opcional (ver ServicoParceiroExecucaoRepository.select).
  parceiro?: Parceiro;
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
  /** @deprecated Dropdown único (materiais/equipamentos/serviços) —
   * substituído por `tipos_fornecimento` (múltipla escolha, categorias mais
   * específicas — ver sql-migration-015). Mantido no schema só por
   * compatibilidade com fornecedores já cadastrados; a UI não escreve mais
   * aqui. */
  tipo_fornecimento: "materiais" | "equipamentos" | "servicos" | null;
  /** Categorias de fornecimento (ver `CategoriaFornecimento`) — um
   * fornecedor pode ter mais de uma (ex.: Isolantes + Ferragens). Substitui
   * `tipo_fornecimento` (único) E a `especialidade` (única) que a migração
   * 014 tinha adicionado por engano — ver sql-migration-015. Fornecedores
   * cadastrados antes desta migração ficam com array vazio até serem
   * editados de novo. */
  tipos_fornecimento: CategoriaFornecimento[];
  notas: string | null;
  pessoa_contato: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Documento anexado a um fornecedor — mesmo padrão de `ParceiroAnexo`,
 * editável só na tela de Editar Fornecedor. */
export interface FornecedorAnexo {
  id: string;
  fornecedor_id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho_bytes: number;
  storage_path: string;
  url: string;
  data_adicao: string;
  adicionado_por: string | null;
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
  /** Preenchido só na finalização, e OPCIONAL (pedido explícito: valor real
   * não bloqueia mais finalizar — ver finalizarServico.ts) — base da análise
   * "real vs orçado" quando preenchido; fica `null` quando o serviço é
   * finalizado sem informar. */
  valor_real: number | null;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  data_fim_real: string | null;
  /** @deprecated Modelo antigo de "um parceiro principal" — substituído por
   * `parceiros_execucao` (ver sql-migration-013). Mantido no schema só por
   * compatibilidade com serviços criados antes dessa mudança; a UI não
   * escreve mais aqui. */
  parceiro_principal_id: string | null;
  /** @deprecated Ver `parceiro_principal_id`. */
  pessoas_alocadas: number | null;
  /** @deprecated Parceiros de apoio sem headcount individual — substituído
   * por `parceiros_execucao`, onde cada parceiro tem seu próprio headcount. */
  parceiros_alocados: string[];
  descricao: string | null;
  notas: string | null;
  /** @deprecated Substituído por `fotos_url` (lista única, ver
   * sql-migration-013 decisão 5) — a foto que estava aqui foi copiada pro
   * início de `fotos_url` na migração; a UI não escreve mais nesta coluna. */
  foto_principal_url: string | null;
  /** Lista única de fotos do serviço (até 20) — ver decisão 5 em
   * sql-migration-013. */
  fotos_url: string[];
  pdf_relatorio_url: string | null;
  responsavel_email: string | null;
  created_at: string;
  updated_at: string;
  // Preenchidos via join, opcionais (ver ServicoRepository.select).
  cliente?: Cliente;
  /** @deprecated Ver `parceiro_principal_id`. */
  parceiro_principal?: Parceiro;
  /** Parceiros vinculados ao serviço, cada um com seu headcount/tipos de
   * trabalho — ver `ServicoParceiroExecucao`. */
  parceiros_execucao?: ServicoParceiroExecucao[];
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
