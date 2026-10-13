// Estado do wizard "Novo Orçamento", compartilhado entre as rotas
// step-1-cliente .. step-6-revisao (cada step é uma rota real do App
// Router; o Zustand é o que preserva os dados ao navegar entre elas).
//
// Um orçamento pode ter vários "itens" (trechos técnicos independentes — ex.: linha de
// vapor quente + linha de água gelada no mesmo projeto = orçamento "misto"). Cada trecho
// tem: um Escopo (lista de itens de área — tubulação/curva/plano, ver
// lib/usecases/orcamento/escopo.ts), UMA especificação técnica (quente OU frio, nunca as
// duas no mesmo trecho) e uma precificação por m² (ver lib/usecases/orcamento/precificarTrecho.ts).
// O usuário preenche escopo + especificações + preços um trecho por vez (`escopoAtual` +
// `itemAtual`); ao confirmar, o trecho vai para a lista `itens` e o formulário limpa para
// o próximo (ou segue pro próximo step, se só houver um).

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CalcularOrcamentoResultado,
  CalcularTermicoResultadoFrio,
  CalcularTermicoResultadoQuente,
  Cliente,
  CombustivelTipo,
  FuncaoMaoObra,
  ItemEscopo,
  MaoObraEquipe,
  TipoTrabalho,
} from "./types";
import type { PrecificacaoTrecho } from "./usecases/orcamento";
import {
  EQUIPE_PADRAO,
  calcularMaoObraEquipe,
  distribuirMaoObraPorTrecho,
  type EquipeMaoObra,
  type ParametrosEquipe,
} from "./usecases/orcamento/maoObraEquipe";

export interface WizardEspecificacoes {
  tipo_trabalho: TipoTrabalho;
  /** FK para precos_config (tipo_material isolante_*) — a escolha comercial.
   * `null` quando `isolante_customizado_nome` está preenchido ("Outro
   * material", migração 019) — os dois são mutuamente exclusivos. */
  preco_isolante_id: number | null;
  /** FK para precos_config (tipo_material chaparia_*) — só usado no quente.
   * `null` quando `acabamento_customizado_nome` está preenchido, mesma
   * lógica de `preco_isolante_id`. */
  preco_acabamento_id: number | null;
  /** "Outro material" (migração 019) — nome livre + preço manual por m²,
   * usado SÓ pra quantificação/preço; não tem dado físico (k(T)) cadastrado,
   * então um trecho com isolante customizado não roda o cálculo térmico
   * (ver step-3-especificacoes/page.tsx). */
  isolante_customizado_nome: string | null;
  isolante_customizado_preco_m2: number | null;
  acabamento_customizado_nome: string | null;
  acabamento_customizado_preco_m2: number | null;
  /** Trabalho acima de 2m de altura neste trecho (migração 019) — só afeta a
   * eficiência da mão de obra automática, nunca a quantificação de material.
   * Escolhido na Tela 2 (Escopo), guardado aqui porque é um atributo do
   * TRECHO inteiro, igual `metragem_editada`. */
  trabalho_altura: boolean;
  /** Obrigatório só no quente; no frio é calculada (ver calcularFrio). */
  espessura_mm: number | null;
  // Nullable de propósito (pedido: "campo vazio, não 0") — 0°C é um valor
  // fisicamente válido em trechos frios, então usar 0 como "não preenchido"
  // bloquearia esse caso real; null é o único jeito seguro de distinguir
  // "usuário ainda não digitou nada" de "usuário digitou zero".
  temperatura_quente: number | null;
  temperatura_ambiente: number | null;
  umidade_relativa: number | null;
  /** Sempre 0 no quente (removido do formulário, por pedido); editável no
   * frio. Nullable pelo mesmo motivo de `temperatura_quente`/`ambiente` —
   * "campo vazio, não 0" — mesmo 0 (calmaria) sendo um valor fisicamente
   * válido, tem que dar pra distinguir "ainda não digitou nada". */
  velocidade_vento_ms: number | null;
  calcular_financeiro: boolean;
  combustivel: CombustivelTipo;
  custo_combustivel: number | null;
  /** Nullable pelo mesmo motivo acima — "campo vazio, não 0" (pedido
   * explícito: apagar tudo deixa a caixa vazia, o sistema bloqueia o avanço
   * em vez de aceitar 0 silenciosamente). */
  horas_operacao_dia: number | null;
  dias_operacao_semana: number | null;
  /** Override da metragem total do trecho (soma do Escopo) — checkbox "editar metragem". */
  metragem_editada: boolean;
  metragem_manual_m2: number | null;
}

/** Linhas da Tela 4 que aceitam ajuste manual. "maoObra" só usa `removida`
 * (excluir a mão de obra do trecho). */
export type ChaveLinhaAjuste = "isolante" | "acabamento" | "rebite" | "parafuso" | "arame" | "silicone" | "maoObra";

export interface OverrideLinha {
  quantidade?: number;
  precoUnitario?: number;
  /** Unidade de medida exibida (pedido "devo poder editar a quantidade, o
   * preço e a unidade de medida") — cosmética: não recalcula nada, só reflete
   * melhor o que a quantidade representa quando o valor automático é
   * ajustado (ex.: trocar "m" por "verba" no Arame). */
  unidade?: string;
  /** Linha excluída deste trecho (pedido explícito: "devo conseguir excluir
   * os itens... não somente editá-los") — zera a quantidade (some do
   * subtotal e do detalhamento persistido, que já filtra `quantidade > 0`)
   * e marca pra sumir da tabela; "Restaurar" limpa o override inteiro,
   * voltando ao valor calculado automaticamente. */
  removida?: boolean;
}

/** Item livre da caixa "Itens Adicionais" da Tela 4 (migração 025/026) — pra
 * casos fora do catálogo/quantificação automática (andaime, linha de vida,
 * etc.): nome, quantidade e preço unitário digitados direto. `categoria`
 * decide em qual subtotal do trecho o item entra — "material" soma no
 * Subtotal de Materiais, "execucao" soma junto com a mão de obra (andaime não
 * é material, é custo de execução do serviço). */
export interface ItemAdicional {
  id: number;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  unidade: string;
  categoria: "material" | "execucao";
}

/** Tudo o que o usuário mexe à mão na Tela 4 de um trecho. Fica no estado do
 * wizard (não só na tela) para sobreviver a recarregar a página e a "Editar"
 * o trecho depois — antes se perdia e tinha que ser refeito. */
export interface AjustesTrecho {
  overrides: Partial<Record<ChaveLinhaAjuste, OverrideLinha>>;
  itensAdicionais: ItemAdicional[];
}

const ajustesVazios: AjustesTrecho = { overrides: {}, itensAdicionais: [] };

export interface WizardItem {
  escopoItens: ItemEscopo[];
  especificacoes: WizardEspecificacoes;
  /** Ajustes manuais da Tela 4 deste trecho — recarregados em "Editar".
   * Ausente em trechos salvos no navegador antes desta mudança. */
  ajustes?: AjustesTrecho;
  materialNome: string;
  acabamentoNome: string | null;
  especificacaoIsolante: string | null;
  especificacaoAcabamento: string | null;
  resultadoTermicoQuente: CalcularTermicoResultadoQuente | null;
  resultadoTermicoFrio: CalcularTermicoResultadoFrio | null;
  precificacao: PrecificacaoTrecho;
  /** = precificacao.subtotal_material — nome mantido para compat com telas que só
   * precisam do custo de material (ex.: totalizadores rápidos). */
  valorMateriais: number;
}

export interface WizardCustosOperacionais {
  km_deslocamento: number;
  noites_hospedagem: number;
  /** Frete em R$ (digitado direto — não mais toneladas × preço). Um
   * `toneladas_frete` de sessões antigas salvo no navegador fica ignorado. */
  valor_frete: number;
  /** Migração 032. */
  diarias_aluguel_carro: number;
  /** Migração 032. */
  quantidade_alimentacao: number;
  /** @deprecated Campo "Desconto extra" removido da Tela 4 (pedido
   * explícito, migração 032) — continua existindo aqui/no motor de cálculo
   * (lib/orcamento.ts) só por compatibilidade; nada na Tela 4 escreve mais
   * aqui. Descontos pós-criação continuam possíveis em Editar Orçamento
   * (campo `valor_desconto`, em R$, mecanismo separado). */
  desconto_percentual_extra: number | null;
}

interface WizardState {
  clienteSelecionado: Cliente | null;
  /** Escolhido na Tela 1 (migração 019) — vale pro orçamento inteiro, não
   * por trecho. "somente_mo" esconde quantificação/preço de material nas
   * telas seguintes e zera o custo de material no cálculo. */
  tipoProposta: "material_mo" | "somente_mo";
  itens: WizardItem[];

  // Rascunho do trecho em edição (step-2-escopo / step-3-especificacoes)
  escopoAtual: ItemEscopo[];
  itemAtual: WizardEspecificacoes;
  resultadoTermicoQuenteAtual: CalcularTermicoResultadoQuente | null;
  resultadoTermicoFrioAtual: CalcularTermicoResultadoFrio | null;
  /** Ajustes manuais da Tela 4 do trecho em edição. */
  ajustesAtual: AjustesTrecho;

  custosOperacionais: WizardCustosOperacionais;
  /** Horas úteis/produtivas por dia PARA ESTE ORÇAMENTO (migração 032,
   * pedido explícito — "preciso que tenha um outro fator na etapa de
   * orçamento que eu possa definir caso a caso quantas horas são úteis de
   * serviço"). `null` = usa o padrão de ConfigEmpresa.horas_uteis_dia.
   * Desde a migração 048 muda também o valor: menos horas produtivas por dia
   * = mais dias de obra = mais diárias. */
  horasUteisDiaOverride: number | null;

  // --- Mão de obra por equipe e diárias (migração 048) — vale pro orçamento
  // inteiro, ver lib/usecases/orcamento/maoObraEquipe.ts ---
  /** Quantas pessoas de cada função. */
  equipe: EquipeMaoObra;
  /** Valor da diária ajustado só para este orçamento, por função; ausente ou
   * `null` = o valor de Configurar Preços. */
  valoresDiariaOverride: Partial<Record<FuncaoMaoObra, number | null>>;
  /** Dias de obra digitados à mão; `null` = calculados (sempre dias
   * fechados, arredondados para cima). */
  diasMaoObraManual: number | null;

  resultadoOrcamento: CalcularOrcamentoResultado | null;

  setCliente: (cliente: Cliente | null) => void;
  setTipoProposta: (tipo: "material_mo" | "somente_mo") => void;
  setEscopoAtual: (itens: ItemEscopo[]) => void;
  setItemAtual: (dados: Partial<WizardEspecificacoes>) => void;
  setResultadoAtualQuente: (resultado: CalcularTermicoResultadoQuente | null) => void;
  setResultadoAtualFrio: (resultado: CalcularTermicoResultadoFrio | null) => void;
  confirmarItemAtual: (dados: {
    materialNome: string;
    acabamentoNome: string | null;
    especificacaoIsolante: string | null;
    especificacaoAcabamento: string | null;
    precificacao: PrecificacaoTrecho;
  }) => void;
  /** Remove o trecho `index` de `itens` e recarrega escopo/especificações dele
   * de volta em `escopoAtual`/`itemAtual`, para reabrir em step-2-escopo
   * (botão "Editar" da Revisão). */
  editarItem: (index: number) => void;
  removerItem: (index: number) => void;
  setCustosOperacionais: (dados: Partial<WizardCustosOperacionais>) => void;
  setHorasUteisDiaOverride: (horas: number | null) => void;
  setEquipe: (dados: Partial<EquipeMaoObra>) => void;
  setValorDiariaOverride: (funcao: FuncaoMaoObra, valor: number | null) => void;
  setDiasMaoObraManual: (dias: number | null) => void;
  setAjustesAtual: (dados: Partial<AjustesTrecho>) => void;
  setResultadoOrcamento: (resultado: CalcularOrcamentoResultado | null) => void;
  reset: () => void;
}

const itemAtualInicial: WizardEspecificacoes = {
  tipo_trabalho: "quente",
  preco_isolante_id: null,
  preco_acabamento_id: null,
  isolante_customizado_nome: null,
  isolante_customizado_preco_m2: null,
  acabamento_customizado_nome: null,
  acabamento_customizado_preco_m2: null,
  trabalho_altura: false,
  espessura_mm: null,
  temperatura_quente: null,
  // Pré-preenchimento pra facilitar (pedido explícito) — mesmo campo serve
  // pro Quente ("Temperatura ambiente") e pro Frio ("Temperatura ambiente",
  // primeiro campo do formulário nesse modo), então um valor só cobre os
  // dois casos pedidos. Continua podendo ser apagado — vira `null`, e o
  // sistema bloqueia o avanço (ver `valido` em step-3-especificacoes).
  temperatura_ambiente: 30,
  // Só usado/validado no Frio (ver FormEspecificacoes.tsx) — pré-preenchido
  // pra facilitar, mas o campo continua no formulário mesmo no Quente
  // (ignorado ali), sem efeito nenhum.
  umidade_relativa: 70,
  velocidade_vento_ms: 0,
  calcular_financeiro: true,
  combustivel: "eletricidade",
  custo_combustivel: null,
  horas_operacao_dia: 8,
  dias_operacao_semana: 5,
  metragem_editada: false,
  metragem_manual_m2: null,
};

const custosOperacionaisIniciais: WizardCustosOperacionais = {
  km_deslocamento: 0,
  noites_hospedagem: 0,
  valor_frete: 0,
  diarias_aluguel_carro: 0,
  quantidade_alimentacao: 0,
  desconto_percentual_extra: null,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      clienteSelecionado: null,
      tipoProposta: "material_mo",
      itens: [],

      escopoAtual: [],
      itemAtual: itemAtualInicial,
      resultadoTermicoQuenteAtual: null,
      resultadoTermicoFrioAtual: null,
      ajustesAtual: ajustesVazios,

      custosOperacionais: custosOperacionaisIniciais,
      horasUteisDiaOverride: null,
      equipe: EQUIPE_PADRAO,
      valoresDiariaOverride: {},
      diasMaoObraManual: null,
      resultadoOrcamento: null,

      setCliente: (cliente) => set({ clienteSelecionado: cliente }),
      setTipoProposta: (tipo) => set({ tipoProposta: tipo }),
      setEscopoAtual: (itens) => set({ escopoAtual: itens }),
      setItemAtual: (dados) => set((state) => ({ itemAtual: { ...state.itemAtual, ...dados } })),
      setResultadoAtualQuente: (resultado) => set({ resultadoTermicoQuenteAtual: resultado }),
      setResultadoAtualFrio: (resultado) => set({ resultadoTermicoFrioAtual: resultado }),

      confirmarItemAtual: ({ materialNome, acabamentoNome, especificacaoIsolante, especificacaoAcabamento, precificacao }) =>
        set((state) => {
          const novoItem: WizardItem = {
            escopoItens: state.escopoAtual,
            especificacoes: state.itemAtual,
            materialNome,
            acabamentoNome,
            especificacaoIsolante,
            especificacaoAcabamento,
            resultadoTermicoQuente: state.resultadoTermicoQuenteAtual,
            resultadoTermicoFrio: state.resultadoTermicoFrioAtual,
            precificacao,
            valorMateriais: precificacao.subtotal_material,
            ajustes: state.ajustesAtual,
          };
          return {
            itens: [...state.itens, novoItem],
            escopoAtual: [],
            itemAtual: itemAtualInicial,
            resultadoTermicoQuenteAtual: null,
            resultadoTermicoFrioAtual: null,
            ajustesAtual: ajustesVazios,
          };
        }),

      editarItem: (index) => {
        const item = get().itens[index];
        if (!item) return;
        set((state) => ({
          itens: state.itens.filter((_, i) => i !== index),
          escopoAtual: item.escopoItens,
          itemAtual: item.especificacoes,
          resultadoTermicoQuenteAtual: item.resultadoTermicoQuente,
          resultadoTermicoFrioAtual: item.resultadoTermicoFrio,
          ajustesAtual: item.ajustes ?? ajustesVazios,
        }));
      },

      removerItem: (index) => set((state) => ({ itens: state.itens.filter((_, i) => i !== index) })),

      setCustosOperacionais: (dados) =>
        set((state) => ({ custosOperacionais: { ...state.custosOperacionais, ...dados } })),
      setHorasUteisDiaOverride: (horas) => set({ horasUteisDiaOverride: horas }),
      setEquipe: (dados) => set((state) => ({ equipe: { ...state.equipe, ...dados } })),
      setValorDiariaOverride: (funcao, valor) =>
        set((state) => ({ valoresDiariaOverride: { ...state.valoresDiariaOverride, [funcao]: valor } })),
      setDiasMaoObraManual: (dias) => set({ diasMaoObraManual: dias }),
      setAjustesAtual: (dados) => set((state) => ({ ajustesAtual: { ...state.ajustesAtual, ...dados } })),
      setResultadoOrcamento: (resultado) => set({ resultadoOrcamento: resultado }),

      reset: () =>
        set({
          clienteSelecionado: null,
          tipoProposta: "material_mo",
          itens: [],
          escopoAtual: [],
          itemAtual: itemAtualInicial,
          resultadoTermicoQuenteAtual: null,
          resultadoTermicoFrioAtual: null,
          ajustesAtual: ajustesVazios,
          custosOperacionais: custosOperacionaisIniciais,
          horasUteisDiaOverride: null,
          equipe: EQUIPE_PADRAO,
          valoresDiariaOverride: {},
          diasMaoObraManual: null,
          resultadoOrcamento: null,
        }),
    }),
    {
      name: "br-isolamentos-wizard",
      // Bug relatado: um estado salvo no navegador ANTES de um campo numérico
      // novo ser adicionado a `custosOperacionais` (ex.: `diarias_aluguel_
      // carro`, migração 032) não tem essa chave. O merge padrão do Zustand
      // (`persist`) é raso — troca `custosOperacionais` INTEIRO pelo objeto
      // salvo, sem preencher chaves que só existem na versão nova do código
      // — a chave ficava `undefined`, e `undefined × preço` = `NaN`
      // contaminava o cálculo inteiro (ver comentário em
      // lib/orcamento.ts#calcularOrcamento). Mesclando campo a campo aqui,
      // qualquer chave nova sempre nasce com o valor padrão atual em vez de
      // ficar ausente, então esse bug não pode se repetir na próxima vez que
      // um campo for adicionado a esses objetos aninhados.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<WizardState> | undefined;
        return {
          ...currentState,
          ...persisted,
          custosOperacionais: { ...currentState.custosOperacionais, ...persisted?.custosOperacionais },
          itemAtual: { ...currentState.itemAtual, ...persisted?.itemAtual },
          equipe: { ...currentState.equipe, ...persisted?.equipe },
          valoresDiariaOverride: { ...persisted?.valoresDiariaOverride },
          ajustesAtual: { ...currentState.ajustesAtual, ...persisted?.ajustesAtual },
        };
      },
    }
  )
);

/** Tipo de trabalho do orçamento inteiro, derivado dos itens: todos iguais → esse tipo,
 * senão "misto". */
export function tipoTrabalhoAgregado(itens: WizardItem[]): TipoTrabalho {
  const tipos = new Set(itens.map((i) => i.especificacoes.tipo_trabalho));
  if (tipos.size === 1) return itens[0].especificacoes.tipo_trabalho;
  return "misto";
}

/** m² equivalentes (metragem ÷ eficiência) de um trecho — a medida de
 * trabalho que a mão de obra da proposta usa. Um trecho salvo no navegador
 * antes da migração 048 não tem o campo; reconstrói a partir da metragem e
 * da eficiência que ele já guardava. */
export function m2EquivalenteDoTrecho(precificacao: PrecificacaoTrecho): number {
  if (typeof precificacao.m2_equivalente_mao_obra === "number") return precificacao.m2_equivalente_mao_obra;
  const eficiencia = precificacao.eficiencia_global > 0 ? precificacao.eficiencia_global : 1;
  return Number((precificacao.metragem_m2 / eficiencia).toFixed(2));
}

/** Mão de obra da proposta para uma lista de trechos, com a equipe, as
 * diárias e as horas úteis escolhidas no wizard. */
export function calcularMaoObraDoWizard(
  itens: Array<Pick<WizardItem, "precificacao">>,
  escolhas: Pick<WizardState, "equipe" | "valoresDiariaOverride" | "horasUteisDiaOverride" | "diasMaoObraManual">,
  parametros: ParametrosEquipe
): MaoObraEquipe {
  return calcularMaoObraEquipe({
    m2Equivalente: itens.reduce((acc, i) => acc + m2EquivalenteDoTrecho(i.precificacao), 0),
    equipe: escolhas.equipe,
    parametros,
    valoresDiaria: escolhas.valoresDiariaOverride,
    horasUteisDia: escolhas.horasUteisDiaOverride,
    diasManual: escolhas.diasMaoObraManual,
  });
}

/** Reparte horas e valor da mão de obra da proposta entre os trechos e
 * refaz os subtotais de cada um: mão de obra do trecho = parte da equipe +
 * itens adicionais de execução dele. */
export function aplicarMaoObraNosTrechos<T extends { precificacao: PrecificacaoTrecho }>(itens: T[], maoObra: MaoObraEquipe): T[] {
  const partes = distribuirMaoObraPorTrecho(
    itens.map((i) => m2EquivalenteDoTrecho(i.precificacao)),
    maoObra
  );
  return itens.map((item, index) => {
    const execucao = item.precificacao.subtotal_itens_execucao ?? 0;
    const subtotalMaoObra = Number((partes[index].valor + execucao).toFixed(2));
    return {
      ...item,
      precificacao: {
        ...item.precificacao,
        m2_equivalente_mao_obra: m2EquivalenteDoTrecho(item.precificacao),
        subtotal_itens_execucao: execucao,
        horas_mao_obra: partes[index].horas,
        subtotal_mao_obra: subtotalMaoObra,
        subtotal_trecho: Number((item.precificacao.subtotal_material + subtotalMaoObra).toFixed(2)),
      },
    };
  });
}

/** Soma as horas de obra de todos os trechos (já repartidas por
 * `aplicarMaoObraNosTrechos`) — o `horas_mao_obra` que `calcularOrcamento`
 * recebe; o valor em si vai em `valor_mao_obra_direto`. */
export function horasMaoObraTotal(itens: Array<{ precificacao: PrecificacaoTrecho }>): number {
  return Number(itens.reduce((acc, i) => acc + i.precificacao.horas_mao_obra, 0).toFixed(2));
}
