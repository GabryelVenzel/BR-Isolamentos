import type { Parceiro, Servico } from "../../types/domain";

// Cálculo de capacidade (mobilizado/disponível) por dia — função pura, sem
// I/O, fácil de testar sem mockar Supabase (mesmo espírito de
// lib/usecases/comercial/relatorio.ts). O contexto (lib/contexts/operacional.ts)
// busca `listarAtivosNoDia(data)` e `listarParceiros()` e chama
// `calcularCapacidadeDia`.
//
// "Mobilizado" é sempre relativo a UM DIA específico — por isso não é uma
// coluna persistida (ver decisão 2 em sql-migration-008-operacional-servicos.sql):
// um parceiro pode estar livre hoje e cheio na semana que vem.

export interface CapacidadeParceiroDia {
  parceiroId: string;
  nome: string;
  totalPessoas: number;
  pessoasMobilizadas: number;
  pessoasDisponiveis: number;
  tiposTrabalho: string[];
  servicos: Array<{
    servicoId: string;
    numeroServico: string;
    pessoas: number;
    tipoTrabalho: string | null;
    dataInicio: string | null;
    dataFimPrevista: string | null;
    etapa: string;
  }>;
}

export interface CapacidadeDia {
  data: string;
  totalDisponivel: number;
  totalMobilizado: number;
  totalLivre: number;
  porParceiro: CapacidadeParceiroDia[];
}

/** `servicosAtivos` já deve vir filtrado pro dia em questão (ver
 * ServicoRepository.listarAtivosNoDia) — esta função só agrega, não filtra
 * por data. Só considera `parceiro_principal_id` (ver decisão 3 no SQL:
 * `parceiros_alocados` de apoio não têm headcount individual, então não
 * entram na conta de pessoas mobilizadas). */
export function calcularCapacidadeDia(data: string, parceiros: Parceiro[], servicosAtivos: Servico[]): CapacidadeDia {
  const porParceiro: CapacidadeParceiroDia[] = parceiros
    .filter((p) => p.ativo)
    .map((parceiro) => {
      const servicosDoParceiro = servicosAtivos.filter((s) => s.parceiro_principal_id === parceiro.id);
      const pessoasMobilizadas = servicosDoParceiro.reduce((soma, s) => soma + (s.pessoas_alocadas ?? 0), 0);
      const totalPessoas = parceiro.total_pessoas ?? 0;

      return {
        parceiroId: parceiro.id,
        nome: parceiro.nome,
        totalPessoas,
        pessoasMobilizadas,
        pessoasDisponiveis: Math.max(0, totalPessoas - pessoasMobilizadas),
        tiposTrabalho: parceiro.tipos_trabalho,
        servicos: servicosDoParceiro.map((s) => ({
          servicoId: s.id,
          numeroServico: s.numero_servico,
          pessoas: s.pessoas_alocadas ?? 0,
          tipoTrabalho: s.tipo_trabalho,
          dataInicio: s.data_inicio,
          dataFimPrevista: s.data_fim_prevista,
          etapa: s.etapa,
        })),
      };
    });

  const totalDisponivel = porParceiro.reduce((soma, p) => soma + p.totalPessoas, 0);
  const totalMobilizado = porParceiro.reduce((soma, p) => soma + p.pessoasMobilizadas, 0);

  return {
    data,
    totalDisponivel,
    totalMobilizado,
    totalLivre: Math.max(0, totalDisponivel - totalMobilizado),
    porParceiro,
  };
}

export type NivelOcupacao = "livre" | "atencao" | "critico";

export interface CapacidadeResumoDia {
  data: string;
  totalDisponivel: number;
  totalMobilizado: number;
  totalLivre: number;
  nivel: NivelOcupacao;
}

/** Cor do dia no calendário mensal (Agenda) — conforme % mobilizado do dia:
 * "livre" até 70%, "atencao" 70–90%, "critico" acima de 90% (faixas do
 * pedido original). Sem parceiro nenhum cadastrado = "livre" (nada pra
 * mobilizar, não é um alerta). */
export function nivelOcupacao(totalDisponivel: number, totalMobilizado: number): NivelOcupacao {
  if (totalDisponivel <= 0) return "livre";
  const percentual = (totalMobilizado / totalDisponivel) * 100;
  if (percentual > 90) return "critico";
  if (percentual >= 70) return "atencao";
  return "livre";
}

/** Todos os dias de um mês (1..N) com o resumo de capacidade — usado pelo
 * calendário visual da Agenda (grid de dias coloridos). `servicosDoMes` já
 * deve vir filtrado pro intervalo do mês inteiro (ver
 * ServicoRepository#listarAtivosNoIntervalo) — o filtro por dia específico é
 * feito aqui, em memória, reaproveitando `calcularCapacidadeDia` dia a dia
 * sem uma query por dia. */
export function calcularCapacidadeMes(
  ano: number,
  mes: number,
  parceiros: Parceiro[],
  servicosDoMes: Servico[]
): CapacidadeResumoDia[] {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const resultado: CapacidadeResumoDia[] = [];

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataIso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const servicosAtivosNoDia = servicosDoMes.filter(
      (s) => s.data_inicio && s.data_inicio <= dataIso && (!s.data_fim_prevista || s.data_fim_prevista >= dataIso)
    );
    const { totalDisponivel, totalMobilizado, totalLivre } = calcularCapacidadeDia(dataIso, parceiros, servicosAtivosNoDia);
    resultado.push({
      data: dataIso,
      totalDisponivel,
      totalMobilizado,
      totalLivre,
      nivel: nivelOcupacao(totalDisponivel, totalMobilizado),
    });
  }

  return resultado;
}
