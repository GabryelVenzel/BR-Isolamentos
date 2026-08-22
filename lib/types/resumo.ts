// Tipos de "view model" do dashboard executivo (módulo Resumo) — formas de
// dados já prontas pra UI, distintas dos tipos de domínio "crus" de
// lib/types/domain.ts. Nada aqui é persistido; são só os retornos das rotas
// de app/api/resumo/*.

export type Periodo = "7d" | "30d" | "90d" | "mes" | "ano" | "tudo" | "custom";
export type TipoTrabalhoFiltro = "quente" | "frio" | "misto";

/** Filtros cross-cutting da FilterBar — ver components/modules/resumo/FilterBar.tsx. */
export interface FiltrosResumo {
  periodo: Periodo;
  dataInicioCustom?: string;
  dataFimCustom?: string;
  tipoTrabalho?: TipoTrabalhoFiltro;
  responsavel?: string; // usuarios.email
}

export type CorTendencia = "positiva" | "negativa" | "neutra";

export interface Tendencia {
  percentual: number | null; // null quando não há período anterior pra comparar (ex.: divisão por zero)
  cor: CorTendencia;
}

export interface KpisResumo {
  periodoLabel: string; // "Este mês", "Últimos 30 dias", etc. — pro card decidir o título dinamicamente
  receita: {
    valor: number;
    tendencia: Tendencia;
  };
  leadsAtivos: {
    quantidade: number;
    valorEmProspeccao: number;
    novosNoPeriodo: number;
  };
  fechados: {
    quantidade: number;
    valorEstimado: number;
    taxaConversaoPercentual: number;
    tendencia: Tendencia;
  };
  aReceber: {
    valor: number;
    quantidadeFaturas: number;
    vencidas: {
      quantidade: number;
      valor: number;
    };
  };
  despesas: {
    valor: number;
    custosFixosConfigurados: number;
    tendencia: Tendencia;
  };
  saldo: {
    valor: number;
    margemPercentual: number | null;
    status: "saudavel" | "atencao" | "critico";
    ultimosTresMeses: number[]; // mais antigo -> mais recente
  };
}

export type SeveridadeAlerta = "critico" | "atencao";

export interface AlertaResumo {
  id: string;
  severidade: SeveridadeAlerta;
  mensagem: string;
  href: string;
  acaoLabel: string;
}

export interface PontoReceitaDespesa {
  mes: string; // "jan/26"
  receita: number;
  despesa: number;
  lucro: number;
}

export interface EtapaFunilResumo {
  etapa: string;
  label: string;
  quantidade: number;
  valorTotal: number;
  retencaoPercentual: number | null; // null na primeira etapa (não há "anterior")
}

export interface DistribuicaoTipoResumo {
  tipo: "quente" | "frio" | "misto";
  label: string;
  valor: number;
  percentual: number;
}

export interface ParceiroTopResumo {
  id: string;
  nome: string;
  horasAlocadas: number;
  horasDisponiveis: number;
  percentualUtilizacao: number;
}

export interface DiaCashFlow {
  dia: number; // 1-30
  data: string; // ISO
  saldoProjetado: number;
  negativo: boolean;
}

export interface ProjecaoCaixaResumo {
  dias: DiaCashFlow[];
  saldoHoje: number;
  saldoFinalPeriodo: number;
  diasNegativos: number;
  primeiroDiaNegativo: string | null;
}
