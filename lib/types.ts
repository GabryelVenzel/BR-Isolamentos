// Interfaces centrais do domínio BR Isolamentos.
// Espelham as tabelas definidas em sql-schema.sql.

export type Role = "admin" | "consultor";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  telefone: string | null;
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
  cidade: string | null;
  estado: string | null;
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

export type TipoItemEscopo = "tubulacao" | "curva" | "plano";

/** Um item do Escopo de um trecho (ex.: "Tubo principal Ø100mm, 15m") — ver
 * lib/usecases/orcamento/escopo.ts para as fórmulas de metragem. Guardado
 * como jsonb em `itens_orcamento.escopo_itens` (migração 010): é o
 * detalhamento que soma até a metragem total do trecho, não precisa de
 * tabela própria (nenhum outro lugar do sistema consulta um item de escopo
 * isoladamente). */
export interface ItemEscopo {
  id: string;
  nome: string;
  tipo: TipoItemEscopo;
  diametro_mm: number | null;
  comprimento_m: number | null;
  quantidade: number | null;
  metragem_manual_m2: number | null;
  /** true = usar `metragem_manual_m2`; false = usar a metragem calculada pela fórmula do tipo. */
  metragem_editada: boolean;
}

/**
 * Um "trecho" técnico dentro de um orçamento (ex.: linha de vapor quente + linha de
 * água gelada no mesmo projeto = 2 itens). Um orçamento sempre tem 1+ itens; quando
 * todos têm o mesmo tipo_trabalho, o orçamento herda esse tipo — senão é "misto".
 * Cada trecho tem exatamente 1 tipo_trabalho (não mistura quente/frio dentro
 * do mesmo trecho — só entre trechos diferentes do mesmo orçamento).
 */
export interface ItemOrcamento {
  id: number;
  orcamento_id: number;
  ordem: number;
  tipo_trabalho: TipoTrabalho;

  // Escopo (migração 010) — itens que compõem a metragem deste trecho.
  escopo_itens: ItemEscopo[];

  // Especificações técnicas
  material: string;
  acabamento: string | null;
  /** Só a densidade/espessura escolhida (ex. "96kg/m³") — `material` já tem o nome completo. */
  especificacao_isolante: string | null;
  especificacao_acabamento: string | null;
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

  // Quantificação (Método Expert em kg) — só preenchido em orçamentos
  // criados ANTES da migração 010; o wizard novo não usa mais (ver decisão 2
  // em sql-migration-010-orcamento-escopo-materiais.sql). Mantido para
  // continuar exibindo orçamentos antigos corretamente.
  manta_kg: number | null;
  chapa_kg: number | null;
  rebites: number | null;
  parafusos: number | null;
  arame_kg: number | null;
  vedacao_pu: number | null;
  vedacit_un: number | null;

  // Precificação por m² (migração 010) — preço travado no momento da
  // criação do trecho (não recalcula sozinho se o catálogo mudar depois).
  // Quando o isolante/acabamento é "Outro material" (customizado, migração
  // 019), `material`/`acabamento` guardam o nome digitado e este preço é o
  // valor manual informado — nenhuma coluna nova precisa disso.
  preco_isolante_m2: number | null;
  preco_acabamento_m2: number | null;
  /** Trabalho acima de 2m de altura neste trecho (migração 019) — só afeta
   * a eficiência da mão de obra, nunca a quantificação de material. Sem
   * proxy no Escopo (diferente de "tem curvas"/"tubulação pequena", que já
   * são deriváveis de `escopo_itens` — ver lib/usecases/orcamento/escopo.ts). */
  trabalho_altura: boolean;
  /** Produto dos fatores de eficiência aplicados (tubulação pequena × curva
   * × altura × fator BR) — cache só para exibição/auditoria na proposta,
   * não recalcula nada sozinho depois de salvo (migração 019). */
  eficiencia_global: number | null;
  horas_mao_obra: number;
  subtotal_material: number;
  subtotal_mao_obra: number;

  /** Detalhamento por material (isolante/acabamento/rebite/parafuso/arame/
   * silicone) deste trecho, já com quantidade e preço finais (inclui
   * overrides feitos no lápis da Tela 4) — persistido a partir da migração
   * 020 especificamente para a Proposta Comercial poder reconstruir a
   * mesma tabela de quantificação mostrada no wizard (antes disso só o
   * total agregado em `subtotal_material` sobrevivia ao salvar). Vazio em
   * orçamentos "somente_mo" e em orçamentos criados antes da migração 020,
   * que só têm o agregado. */
  detalhamento_materiais: LinhaDetalhamentoMaterial[];

  // Custo de materiais só deste item
  valor_materiais: number;
}

/** Uma linha da tabela de quantificação de materiais (ver `precificarTrecho`
 * em lib/usecases/orcamento/precificarTrecho.ts) — mesmas linhas mostradas
 * (com botão de editar) na Tela 4 do wizard, agora persistidas por trecho. */
export interface LinhaDetalhamentoMaterial {
  /** "item_adicional_material"/"item_adicional_execucao" (migração 025/026)
   * — linha livre digitada pelo usuário na Tela 4 (ex.: "Andaime", "Linha de
   * vida"), preço direto por unidade, fora do catálogo/quantificação
   * automática. A chave já carrega a categoria escolhida (Material soma no
   * subtotal de materiais; Execução soma junto com a mão de obra — ex.:
   * andaime não é material, é custo de execução do serviço). Pode haver
   * várias linhas com a mesma chave num trecho (uma por item adicionado). */
  chave: "isolante" | "acabamento" | "rebite" | "parafuso" | "arame" | "silicone" | "item_adicional_material" | "item_adicional_execucao";
  titulo: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  subtotal: number;
}

export interface Orcamento {
  id: number;
  /** Número "oficial" da proposta (ex.: "ORC-2026-0001") — já existia,
   * gerado em lib/repositories/orcamento.repository.ts#proximoNumero e
   * usado em PDFs de proposta emitidos. */
  numero: string;
  /** Código curto auto-gerado (O00001, O00002, ...) — ver
   * sql-migration-008-operacional-servicos.sql. Usado pela integração
   * Lead→Orçamento→Serviço (módulos Comercial/Operacional); NÃO substitui
   * `numero`, que continua sendo o número da proposta em si. */
  numero_orcamento: string | null;
  cliente_id: number;
  data_criacao: string;
  tipo_trabalho: TipoTrabalho;
  /** Escolhido no passo 1 do wizard (migração 019) — "somente_mo" esconde a
   * quantificação/preço de material nas telas 4/6 e zera `valor_materiais`
   * no cálculo; o restante do motor (impostos/margem/custos operacionais)
   * não muda. */
  tipo_proposta: "material_mo" | "somente_mo";

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

  /** Nota livre digitada na Revisão (Tela 5) ou depois em Editar Orçamento —
   * exibida na Proposta Comercial quando preenchida (migração 021). */
  observacoes_adicionais: string | null;

  // Preenchido via join, opcional
  cliente?: Cliente;
  itens?: ItemOrcamento[];
}

/** Catálogo comercial por m² (migração 010) — ver decisão 2 em
 * sql-migration-010-orcamento-escopo-materiais.sql. Os 7 tipos antigos em kg
 * (manta/chapa/rebite/parafuso/arame/vedacao/vedacit, o "Método Expert") não
 * existem mais em `precos_config` — só continuam como tipo em
 * `TipoMaterialPreco` porque `lib/orcamento.ts#detalharValorMateriais` ainda
 * precisa tipar o detalhamento de orçamentos ANTIGOS ao exibi-los. */
export type TipoMaterialPreco =
  | "chaparia_inox"
  | "chaparia_galvanizado"
  | "chaparia_aluminio"
  | "isolante_fibra_ceramica"
  | "isolante_la_rocha"
  | "isolante_espuma"
  // Materiais adicionais (migração 016) — arame/parafusos/silicone de
  // volta no catálogo comercial, mas como tipos NOVOS (não reaproveitam
  // `arame`/`parafuso`/`vedacit` abaixo, que são só do Método Expert
  // antigo) — preço em unidade própria (kg/centena/frasco), não m².
  | "acessorio_arame"
  | "acessorio_parafuso"
  | "acessorio_rebite"
  | "acessorio_silicone"
  | "manta"
  | "chapa"
  | "rebite"
  | "parafuso"
  | "arame"
  | "vedacao"
  | "vedacit";

export type GrupoMaterialPreco = "chaparia" | "isolante" | "acessorio";

export function grupoDoTipoMaterial(tipo: TipoMaterialPreco): GrupoMaterialPreco | null {
  if (tipo.startsWith("chaparia_")) return "chaparia";
  if (tipo.startsWith("isolante_")) return "isolante";
  if (tipo.startsWith("acessorio_")) return "acessorio";
  return null;
}

export interface PrecoConfig {
  id: number;
  tipo_material: TipoMaterialPreco;
  descricao: string;
  /** Ex.: "0,8mm", "96kg/m³" — só o valor da especificação (migração 010). */
  especificacao: string | null;
  /** Sempre "m2" no catálogo novo. */
  unidade: string;
  preco_unitario: number;
  densidade_kg_m3: number | null;
  ativo: boolean;
  /** Posição dentro do grupo (`tipo_material`) — chaparia fina→grossa,
   * isolante menor→maior densidade (migração 017). Não editável na tela de
   * preços, só controla a ordem de exibição. */
  ordem: number;
  ultima_atualizacao: string;
  /** Migração 025 — só em linhas de isolante: nome comercial da família do
   * produto SEM a espessura (ex.: "Feltro de Lã de Rocha 64kg/m³"), igual
   * pra todas as linhas de espessura diferente da mesma família. Agrupa as
   * linhas que `comporCamadasIsolante` pode combinar entre si — ex.: as 2
   * linhas de "Feltro de Lã de Rocha 64kg/m³" (25mm e 51mm) compartilham a
   * mesma família, então uma espessura de 75mm pode compor as duas juntas.
   * `null` em chaparia/acessório (não fazem composição em camadas). */
  familia: string | null;
  /** Migração 025 — espessura padrão (mm) desta linha específica do
   * catálogo, só em isolante (ex.: 25, 51). `null` em chaparia/acessório. */
  espessura_mm: number | null;
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
  /** @deprecated Removido da tela Configurar Preços (pedido explícito, ver
   * migração 016) — `calcularOrcamento` não usa mais este valor como
   * fallback, sempre 0% quando o orçamento não informa `desconto_percentual_
   * extra` explicitamente. Coluna mantida no schema por compatibilidade. */
  desconto_competitivo: number;

  valor_hora_mao_obra: number;
  valor_km_deslocamento: number;
  valor_noite_hospedagem: number;
  valor_frete_por_tonelada: number;

  /** @deprecated Removido da tela Configurar Preços (pedido explícito, ver
   * migração 016) — só alimentava `lib/quantificador.ts` (Método Expert),
   * que não é mais chamado por nenhuma tela atual (`/api/quantificar`
   * ficou órfão desde a migração 010). Coluna mantida no schema por
   * compatibilidade com orçamentos antigos que ainda exibem `vedacit_un`. */
  vedacit_gramas_por_junta: number;

  // Quantificação de materiais (migração 019) — ver
  // lib/usecases/orcamento/quantificarMateriais.ts. Todos calculados sobre a
  // metragem total (m²) do trecho.
  /** Isolante = m² × (1 + este% /100) — sobra/traspasse. */
  isolante_acrescimo_percentual: number;
  /** Acabamento = m² × (1 + este% /100). */
  acabamento_acrescimo_percentual: number;
  rebite_por_m2: number;
  parafusos_por_m2: number;
  /** @deprecated Substituído por `arame_metros_por_m2` (migração 029) — o
   * catálogo comercial de arame passou a vender por METRO (Arame Aço Inox
   * 304 0,9mm), não mais por peso. Mantido no schema só por compatibilidade
   * com o valor já cadastrado; a UI não lê/escreve mais aqui. */
  arame_gramas_por_m2: number;
  /** Metros de arame por m² de trecho (migração 029) — substitui
   * `arame_gramas_por_m2`. */
  arame_metros_por_m2: number;
  /** "1 frasco de silicone a cada X m²" — o tamanho do frasco (300g) é só
   * informativo na tela, não entra em nenhuma fórmula. */
  silicone_intervalo_m2: number;

  // Mão de obra automática (migração 019) — ver
  // lib/usecases/orcamento/calcularMaoObraAutomatica.ts. Substitui o campo
  // manual "Mão de obra deste trecho (horas)" que existia no wizard.
  m2_por_hora_dupla: number;
  /** Multiplicador quando o trecho tem tubulação/curva com diâmetro < 4"
   * (101,6mm) — derivado do Escopo, não é um campo manual. */
  eficiencia_tubulacao_pequena: number;
  /** Multiplicador quando o trecho tem algum item de escopo do tipo "curva". */
  eficiencia_curva: number;
  /** Multiplicador quando o trecho está marcado como trabalho em altura
   * (> 2m) — único fator que não tem como ser derivado de outro dado. */
  eficiencia_altura: number;
  /** Fator de rendimento da dupla brasileira — sempre aplicado. */
  eficiencia_fator_br: number;
  horas_uteis_dia: number;

  // Condições comerciais e projeções exibidas nas Propostas (migração 020) —
  // parâmetros de exibição/negociação, não entram no cálculo do orçamento em
  // si (ver lib/orcamento.ts) — nunca hardcoded no template do PDF/Word, pra
  // o dono da empresa poder ajustar sem precisar de um novo deploy.
  /** Desconto oferecido para pagamento à vista, exibido nas Condições
   * Comerciais da Proposta — é uma condição OFERECIDA ao cliente, não é
   * aplicado automaticamente no cálculo do orçamento. */
  desconto_avista_percentual: number;
  /** Garantia de mão de obra (meses) exibida nas Propostas. */
  garantia_mao_obra_meses: number;
  /** Reajuste tarifário anual assumido SÓ na projeção de economia de 10 anos
   * da Proposta Comercial — uma estimativa de mercado exibida como tal, não
   * uma garantia contratual. 0 desliga a projeção com reajuste (mostra só a
   * economia constante, sem crescimento). */
  projecao_reajuste_tarifario_percentual: number;
  /** kg de CO₂ absorvido por uma árvore adulta por ano — converte o CO₂
   * evitado em "equivalência de árvores plantadas" na seção ambiental da
   * proposta. Estimativa ilustrativa (varia muito por espécie/idade/fonte),
   * não uma métrica de compensação de carbono certificada. */
  co2_kg_por_arvore_ano: number;
  /** Validade da proposta (dias) — exibida nas Propostas (migração 021),
   * substitui o "30 dias" que antes era fixo no template. */
  validade_proposta_dias: number;
  /** Descrição padrão da forma de pagamento (linha principal, além do
   * desconto à vista e do "parcelado: consulte" que continuam fixos) —
   * migração 021. */
  forma_pagamento_padrao: string;
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
  // Custo de materiais: OU `quantificacao`+`precos` (Método Expert em kg,
  // orçamentos anteriores à migração 010), OU `valor_materiais_direto` (soma
  // dos `subtotal_material` de cada trecho, já precificados por m² — ver
  // lib/usecases/orcamento/precificarTrecho.ts). Nunca os dois.
  quantificacao?: QuantificarResultado;
  precos?: PrecoConfig[];
  valor_materiais_direto?: number;
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
