// Estado do wizard "Novo Orçamento", compartilhado entre as rotas
// step-1-cliente .. step-5-revisao (cada step é uma rota real do App
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
  ItemEscopo,
  TipoTrabalho,
} from "./types";
import type { PrecificacaoTrecho } from "./usecases/orcamento";

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
  /** Sempre 0 no quente (removido do formulário, por pedido); editável no frio. */
  velocidade_vento_ms: number;
  calcular_financeiro: boolean;
  combustivel: CombustivelTipo;
  custo_combustivel: number | null;
  horas_operacao_dia: number;
  dias_operacao_semana: number;
  /** Override da metragem total do trecho (soma do Escopo) — checkbox "editar metragem". */
  metragem_editada: boolean;
  metragem_manual_m2: number | null;
}

export interface WizardItem {
  escopoItens: ItemEscopo[];
  especificacoes: WizardEspecificacoes;
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
  toneladas_frete: number;
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

  custosOperacionais: WizardCustosOperacionais;
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
  temperatura_ambiente: null,
  umidade_relativa: null,
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
  toneladas_frete: 0,
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

      custosOperacionais: custosOperacionaisIniciais,
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
          };
          return {
            itens: [...state.itens, novoItem],
            escopoAtual: [],
            itemAtual: itemAtualInicial,
            resultadoTermicoQuenteAtual: null,
            resultadoTermicoFrioAtual: null,
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
        }));
      },

      removerItem: (index) => set((state) => ({ itens: state.itens.filter((_, i) => i !== index) })),

      setCustosOperacionais: (dados) =>
        set((state) => ({ custosOperacionais: { ...state.custosOperacionais, ...dados } })),
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
          custosOperacionais: custosOperacionaisIniciais,
          resultadoOrcamento: null,
        }),
    }),
    { name: "br-isolamentos-wizard" }
  )
);

/** Tipo de trabalho do orçamento inteiro, derivado dos itens: todos iguais → esse tipo,
 * senão "misto". */
export function tipoTrabalhoAgregado(itens: WizardItem[]): TipoTrabalho {
  const tipos = new Set(itens.map((i) => i.especificacoes.tipo_trabalho));
  if (tipos.size === 1) return itens[0].especificacoes.tipo_trabalho;
  return "misto";
}

/** Soma as horas de mão de obra (já calculadas automaticamente por trecho —
 * ver precificarTrecho.ts/calcularMaoObraAutomatica.ts) de todos os trechos —
 * é o único `horas_mao_obra` que `calcularOrcamento` recebe (a taxa/hora é
 * global, não varia por trecho). */
export function horasMaoObraTotal(itens: WizardItem[]): number {
  return Number(itens.reduce((acc, i) => acc + i.precificacao.horas_mao_obra, 0).toFixed(2));
}
