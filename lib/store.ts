// Estado do wizard "Novo Orçamento", compartilhado entre as rotas
// step-1-cliente .. step-5-revisao (cada step é uma rota real do App
// Router; o Zustand é o que preserva os dados ao navegar entre elas).
//
// Um orçamento pode ter vários "itens" (trechos técnicos independentes — ex.: linha de
// vapor quente + linha de água gelada no mesmo projeto = orçamento "misto"). O usuário
// preenche especificações + calcula um item por vez (`itemAtual`); ao confirmar, o item
// vai para a lista `itens` e o formulário limpa para o próximo trecho (ou segue pro
// próximo step, se só houver um).

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CalcularOrcamentoResultado,
  CalcularTermicoResultadoFrio,
  CalcularTermicoResultadoQuente,
  Cliente,
  CombustivelTipo,
  Geometria,
  QuantificarResultado,
  TipoTrabalho,
} from "./types";

export interface WizardEspecificacoes {
  tipo_trabalho: TipoTrabalho;
  material_id: number | null;
  acabamento_id: number | null;
  geometria: Geometria;
  diametro_mm: number | null;
  area_m2: number;
  perimetro_m: number | null;
  espessuras_mm: number[];
  temperatura_quente: number;
  temperatura_ambiente: number;
  umidade_relativa: number;
  velocidade_vento_ms: number;
  calcular_financeiro: boolean;
  combustivel: CombustivelTipo;
  custo_combustivel: number | null;
  horas_operacao_dia: number;
  dias_operacao_semana: number;
}

export interface WizardItem {
  especificacoes: WizardEspecificacoes;
  materialNome: string;
  acabamentoNome: string | null;
  resultadoTermicoQuente: CalcularTermicoResultadoQuente | null;
  resultadoTermicoFrio: CalcularTermicoResultadoFrio | null;
  quantificacao: QuantificarResultado;
  valorMateriais: number;
}

export interface WizardCustosOperacionais {
  horas_mao_obra: number;
  km_deslocamento: number;
  noites_hospedagem: number;
  toneladas_frete: number;
  desconto_percentual_extra: number | null;
}

interface WizardState {
  clienteSelecionado: Cliente | null;
  itens: WizardItem[];

  // Rascunho do item em edição (step-2/step-3)
  itemAtual: WizardEspecificacoes;
  resultadoTermicoQuenteAtual: CalcularTermicoResultadoQuente | null;
  resultadoTermicoFrioAtual: CalcularTermicoResultadoFrio | null;
  quantificacaoAtual: QuantificarResultado | null;

  custosOperacionais: WizardCustosOperacionais;
  resultadoOrcamento: CalcularOrcamentoResultado | null;

  setCliente: (cliente: Cliente | null) => void;
  setItemAtual: (dados: Partial<WizardEspecificacoes>) => void;
  setResultadoAtualQuente: (resultado: CalcularTermicoResultadoQuente | null) => void;
  setResultadoAtualFrio: (resultado: CalcularTermicoResultadoFrio | null) => void;
  setQuantificacaoAtual: (resultado: QuantificarResultado | null) => void;
  confirmarItemAtual: (materialNome: string, acabamentoNome: string | null, valorMateriais: number) => void;
  removerItem: (index: number) => void;
  setCustosOperacionais: (dados: Partial<WizardCustosOperacionais>) => void;
  setResultadoOrcamento: (resultado: CalcularOrcamentoResultado | null) => void;
  reset: () => void;
}

const itemAtualInicial: WizardEspecificacoes = {
  tipo_trabalho: "quente",
  material_id: null,
  acabamento_id: null,
  geometria: "tubulacao",
  diametro_mm: 88.9,
  area_m2: 10,
  perimetro_m: null,
  espessuras_mm: [51],
  temperatura_quente: 250,
  temperatura_ambiente: 30,
  umidade_relativa: 70,
  velocidade_vento_ms: 0,
  calcular_financeiro: false,
  combustivel: "eletricidade",
  custo_combustivel: null,
  horas_operacao_dia: 8,
  dias_operacao_semana: 5,
};

const custosOperacionaisIniciais: WizardCustosOperacionais = {
  horas_mao_obra: 0,
  km_deslocamento: 0,
  noites_hospedagem: 0,
  toneladas_frete: 0,
  desconto_percentual_extra: null,
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      clienteSelecionado: null,
      itens: [],

      itemAtual: itemAtualInicial,
      resultadoTermicoQuenteAtual: null,
      resultadoTermicoFrioAtual: null,
      quantificacaoAtual: null,

      custosOperacionais: custosOperacionaisIniciais,
      resultadoOrcamento: null,

      setCliente: (cliente) => set({ clienteSelecionado: cliente }),
      setItemAtual: (dados) => set((state) => ({ itemAtual: { ...state.itemAtual, ...dados } })),
      setResultadoAtualQuente: (resultado) => set({ resultadoTermicoQuenteAtual: resultado }),
      setResultadoAtualFrio: (resultado) => set({ resultadoTermicoFrioAtual: resultado }),
      setQuantificacaoAtual: (resultado) => set({ quantificacaoAtual: resultado }),

      confirmarItemAtual: (materialNome, acabamentoNome, valorMateriais) =>
        set((state) => {
          if (!state.quantificacaoAtual) return state;
          const novoItem: WizardItem = {
            especificacoes: state.itemAtual,
            materialNome,
            acabamentoNome,
            resultadoTermicoQuente: state.resultadoTermicoQuenteAtual,
            resultadoTermicoFrio: state.resultadoTermicoFrioAtual,
            quantificacao: state.quantificacaoAtual,
            valorMateriais,
          };
          return {
            itens: [...state.itens, novoItem],
            itemAtual: itemAtualInicial,
            resultadoTermicoQuenteAtual: null,
            resultadoTermicoFrioAtual: null,
            quantificacaoAtual: null,
          };
        }),

      removerItem: (index) => set((state) => ({ itens: state.itens.filter((_, i) => i !== index) })),

      setCustosOperacionais: (dados) =>
        set((state) => ({ custosOperacionais: { ...state.custosOperacionais, ...dados } })),
      setResultadoOrcamento: (resultado) => set({ resultadoOrcamento: resultado }),

      reset: () =>
        set({
          clienteSelecionado: null,
          itens: [],
          itemAtual: itemAtualInicial,
          resultadoTermicoQuenteAtual: null,
          resultadoTermicoFrioAtual: null,
          quantificacaoAtual: null,
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
