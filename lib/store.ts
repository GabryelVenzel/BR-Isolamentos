// Estado do wizard "Novo Orçamento", compartilhado entre as rotas
// step-1-cliente .. step-5-revisao (cada step é uma rota real do App
// Router; o Zustand é o que preserva os dados ao navegar entre elas).

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

export interface WizardCustosOperacionais {
  horas_mao_obra: number;
  km_deslocamento: number;
  noites_hospedagem: number;
  toneladas_frete: number;
  desconto_percentual_extra: number | null;
}

interface WizardState {
  clienteSelecionado: Cliente | null;
  especificacoes: WizardEspecificacoes;
  custosOperacionais: WizardCustosOperacionais;
  resultadoTermicoQuente: CalcularTermicoResultadoQuente | null;
  resultadoTermicoFrio: CalcularTermicoResultadoFrio | null;
  quantificacao: QuantificarResultado | null;
  resultadoOrcamento: CalcularOrcamentoResultado | null;

  setCliente: (cliente: Cliente | null) => void;
  setEspecificacoes: (dados: Partial<WizardEspecificacoes>) => void;
  setCustosOperacionais: (dados: Partial<WizardCustosOperacionais>) => void;
  setResultadoTermicoQuente: (resultado: CalcularTermicoResultadoQuente | null) => void;
  setResultadoTermicoFrio: (resultado: CalcularTermicoResultadoFrio | null) => void;
  setQuantificacao: (resultado: QuantificarResultado | null) => void;
  setResultadoOrcamento: (resultado: CalcularOrcamentoResultado | null) => void;
  reset: () => void;
}

const especificacoesIniciais: WizardEspecificacoes = {
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
      especificacoes: especificacoesIniciais,
      custosOperacionais: custosOperacionaisIniciais,
      resultadoTermicoQuente: null,
      resultadoTermicoFrio: null,
      quantificacao: null,
      resultadoOrcamento: null,

      setCliente: (cliente) => set({ clienteSelecionado: cliente }),
      setEspecificacoes: (dados) =>
        set((state) => ({ especificacoes: { ...state.especificacoes, ...dados } })),
      setCustosOperacionais: (dados) =>
        set((state) => ({ custosOperacionais: { ...state.custosOperacionais, ...dados } })),
      setResultadoTermicoQuente: (resultado) => set({ resultadoTermicoQuente: resultado }),
      setResultadoTermicoFrio: (resultado) => set({ resultadoTermicoFrio: resultado }),
      setQuantificacao: (resultado) => set({ quantificacao: resultado }),
      setResultadoOrcamento: (resultado) => set({ resultadoOrcamento: resultado }),
      reset: () =>
        set({
          clienteSelecionado: null,
          especificacoes: especificacoesIniciais,
          custosOperacionais: custosOperacionaisIniciais,
          resultadoTermicoQuente: null,
          resultadoTermicoFrio: null,
          quantificacao: null,
          resultadoOrcamento: null,
        }),
    }),
    { name: "br-isolamentos-wizard" }
  )
);
