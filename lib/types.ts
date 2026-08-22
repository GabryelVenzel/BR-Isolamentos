// Interfaces centrais do domínio BR Isolamentos.
// Espelham as tabelas definidas em sql-schema.sql.

export type Role = "admin" | "consultor";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  role: Role;
  ativo: boolean;
  criado_em: string;
}

export interface Cliente {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cnpj_cpf: string | null;
  criado_em: string;
  criado_por: string | null;
}

export type TipoTrabalho = "quente" | "frio" | "misto";
export type Geometria = "plana" | "tubulacao";
export type StatusOrcamento =
  | "rascunho"
  | "proposta"
  | "enviado"
  | "aceito"
  | "rejeitado";

/**
 * Um "trecho" técnico dentro de um orçamento (ex.: linha de vapor quente + linha de
 * água gelada no mesmo projeto = 2 itens). Um orçamento sempre tem 1+ itens; quando
 * todos têm o mesmo tipo_trabalho, o orçamento herda esse tipo — senão é "misto".
 */
export interface ItemOrcamento {
  id: number;
  orcamento_id: number;
  ordem: number;
  tipo_trabalho: TipoTrabalho;

  // Especificações técnicas
  material: string;
  acabamento: string | null;
  temperatura_quente: number;
  temperatura_ambiente: number;
  umidade_relativa: number | null;
  velocidade_vento: number | null;
  geometria: Geometria;
  diametro_mm: number | null;
  area_m2: number;
  perimetro_m: number | null;

  // Resultados dos cálculos
  espessura_necessaria_mm: number;
  temperatura_face_fria: number | null;
  perda_com_isolante: number;
  perda_sem_isolante: number;
  economia_anual: number | null;
  co2_ton_ano: number | null;

  // Quantificação
  manta_kg: number | null;
  chapa_kg: number | null;
  rebites: number | null;
  parafusos: number | null;
  arame_kg: number | null;
  vedacao_pu: number | null;
  vedacit_un: number | null;

  // Custo de materiais só deste item
  valor_materiais: number;
}

export interface Orcamento {
  id: number;
  numero: string;
  cliente_id: number;
  data_criacao: string;
  tipo_trabalho: TipoTrabalho;

  // Financeiro
  valor_materiais: number;
  valor_mao_obra: number;
  valor_deslocamento: number;
  valor_hospedagem: number;
  valor_frete: number;
  subtotal: number;
  detalhamento_impostos: ItemDetalhamentoImposto[];
  total_impostos: number;
  margem_lucro: number;
  valor_desconto: number;
  preco_cheio: number;
  valor_final: number;

  // Status
  status: StatusOrcamento;
  proposta_pdf_url: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  // Responsável pela venda (email de `usuarios`) — coluna adicionada em
  // sql-migration-004-6modulos-completo.sql, usada pelo filtro "Responsável"
  // do dashboard executivo (módulo Resumo).
  atribuido_a: string | null;

  // Preenchido via join, opcional
  cliente?: Cliente;
  itens?: ItemOrcamento[];
}

export type TipoMaterialPreco =
  | "manta"
  | "chapa"
  | "rebite"
  | "parafuso"
  | "arame"
  | "vedacao"
  | "vedacit";

export interface PrecoConfig {
  id: number;
  tipo_material: TipoMaterialPreco;
  descricao: string;
  preco_unitario: number;
  densidade_kg_m3: number | null;
  ativo: boolean;
  ultima_atualizacao: string;
}

export type RegimeTributario = "simples_nacional" | "lucro_presumido" | "personalizado";
export type AnexoSimplesNacional = "III" | "IV";

export interface ConfigEmpresa {
  id: number;
  nome_empresa: string;
  email_empresa: string | null;
  telefone_empresa: string | null;
  cnpj: string | null;

  // Regime tributário — define como o percentual de impostos "base" é calculado.
  // Impostos extras (opcionais, variam por contrato) ficam em `impostos_config`.
  regime_tributario: RegimeTributario;
  // Usado só quando regime_tributario === "simples_nacional". Anexo IV é o padrão do
  // sistema (mais próximo de serviço de instalação/engenharia) — CONFIRMAR COM O
  // CONTADOR, pode variar conforme a atividade exata contratada.
  simples_nacional_anexo: AnexoSimplesNacional;
  // Receita bruta dos últimos 12 meses (RBT12), usada na fórmula oficial do Simples
  // Nacional. Enquanto for 0, o cálculo de orçamento bloqueia com aviso.
  simples_nacional_rbt12: number;

  margem_lucro_padrao: number;
  desconto_competitivo: number;

  valor_hora_mao_obra: number;
  valor_km_deslocamento: number;
  valor_noite_hospedagem: number;
  valor_frete_por_tonelada: number;

  // Assunção documentada: gramas de Vedacit consumidos por junta de vedação P.U.
  // Não há esse dado nas planilhas originais — validar com a operação real.
  vedacit_gramas_por_junta: number;
}

/** Imposto/taxa adicional configurável livremente (ex.: INSS retido em cessão de mão
 * de obra), somado por cima do percentual "base" do regime tributário. */
export interface ImpostoConfig {
  id: number;
  nome: string;
  percentual: number;
  ativo: boolean;
  ordem: number;
}

export interface MaterialIsolante {
  id: number;
  nome: string;
  k_func: string; // fórmula em função de T (°C médio), ex: "0.031 + 0.00019*T"
  t_min: number;
  t_max: number;
  densidade_kg_m3: number;
  categoria: string | null;
  ativo: boolean;
}

export interface Acabamento {
  id: number;
  nome: string;
  emissividade: number;
  ativo: boolean;
}

// --- Payloads de API ---

export interface CalcularTermicoInput {
  tipo_trabalho: TipoTrabalho;
  material_k_func: string;
  t_min: number;
  t_max: number;
  emissividade: number;
  geometria: Geometria;
  diametro_mm?: number;
  espessuras_mm: number[]; // uma ou mais camadas
  temperatura_quente: number; // Tq (quente) ou Ti (frio)
  temperatura_ambiente: number;
  velocidade_vento_ms?: number;
  // Apenas para "frio"
  umidade_relativa?: number;
  // Apenas para "quente" com retorno financeiro
  calcular_financeiro?: boolean;
  combustivel?: CombustivelTipo;
  custo_combustivel?: number;
  area_m2?: number;
  horas_operacao_dia?: number;
  dias_operacao_semana?: number;
}

export type CombustivelTipo =
  | "vapor"
  | "eletricidade"
  | "gas_natural"
  | "glp"
  | "oleo_diesel"
  | "oleo_bpf"
  | "lenha_eucalipto";

export interface CalcularTermicoResultadoQuente {
  temperatura_face_fria: number;
  temperaturas_interfaces: number[];
  perda_com_isolante_kw_m2: number;
  perda_sem_isolante_kw_m2: number;
  convergiu: boolean;
  financeiro?: {
    economia_mensal: number;
    economia_anual: number;
    reducao_percentual: number;
    co2_ton_ano: number;
  };
}

export interface CalcularTermicoResultadoFrio {
  temperatura_orvalho: number;
  espessura_minima_mm: number | null;
  convergiu: boolean;
}

export interface QuantificarInput {
  espessura_mm: number;
  area_m2: number;
  perimetro_m: number;
  densidade_manta_kg_m3: number;
  densidade_chapa_kg_m3: number;
  vedacit_gramas_por_junta: number;
}

export interface QuantificarResultado {
  manta_kg: number;
  chapa_kg: number;
  rebites: number;
  parafusos: number;
  arame_kg: number;
  vedacao_pu: number;
  vedacit_un: number;
}

export interface CalcularOrcamentoInput {
  quantificacao: QuantificarResultado;
  precos: PrecoConfig[];
  config: ConfigEmpresa;
  impostosExtras: ImpostoConfig[];
  horas_mao_obra: number;
  km_deslocamento: number;
  noites_hospedagem: number;
  toneladas_frete: number;
  desconto_percentual_extra?: number;
}

export interface ItemDetalhamentoImposto {
  nome: string;
  percentual: number;
  valor: number;
}

export interface CalcularOrcamentoResultado {
  valor_materiais: number;
  valor_mao_obra: number;
  valor_deslocamento: number;
  valor_hospedagem: number;
  valor_frete: number;
  subtotal: number;
  detalhamento_impostos: ItemDetalhamentoImposto[];
  total_impostos: number;
  percentual_impostos: number;
  margem_lucro: number;
  percentual_margem: number;
  valor_desconto: number;
  preco_cheio: number;
  valor_final: number;
  detalhamento_materiais: Array<{
    tipo: TipoMaterialPreco;
    quantidade: number;
    preco_unitario: number;
    total: number;
  }>;
}
