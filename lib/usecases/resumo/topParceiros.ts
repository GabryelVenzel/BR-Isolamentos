import type { AgendamentoRepository, ParceiroRepository } from "../../repositories";
import type { ParceiroTopResumo } from "../../types/resumo";

const SEMANAS_POR_MES = 4.33;

/**
 * Top 5 parceiros por horas alocadas este mês, cruzando agendamentos ativos
 * (status agendado/em_progresso — os únicos que realmente ocupam agenda) com
 * a disponibilidade cadastrada. Calculado aqui em vez de reusar
 * `v_capacidade_parceiros` porque a view não é restrita ao mês corrente
 * (soma TODOS os agendamentos ativos, de qualquer data) — "este mês",
 * pedido explicitamente no card, precisa de outro corte.
 *
 * Quando um agendamento tem mais de um parceiro em `parceiros_alocados`, as
 * horas estimadas contam inteiras para CADA parceiro alocado (é quanto
 * tempo aquela pessoa fica ocupada, não uma fração do total da equipe).
 */
export async function topParceiros(
  parceiroRepo: ParceiroRepository,
  agendamentoRepo: AgendamentoRepository
): Promise<ParceiroTopResumo[]> {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [parceiros, agendamentosAgendado, agendamentosEmProgresso] = await Promise.all([
    // capacidade=mao_de_obra (migração 027) — "parceria" pura não mobiliza
    // gente, não faz sentido aparecer num ranking de horas alocadas.
    parceiroRepo.listar({ ativo: true, capacidade: "mao_de_obra" }),
    agendamentoRepo.listar({ status: "agendado", dataInicio: inicioMes, dataFim: fimMes }),
    agendamentoRepo.listar({ status: "em_progresso", dataInicio: inicioMes, dataFim: fimMes }),
  ]);
  const agendamentos = [...agendamentosAgendado, ...agendamentosEmProgresso];

  const horasPorParceiro = new Map<string, number>();
  for (const agendamento of agendamentos) {
    for (const parceiroId of agendamento.parceiros_alocados) {
      horasPorParceiro.set(parceiroId, (horasPorParceiro.get(parceiroId) ?? 0) + (agendamento.horas_estimadas ?? 0));
    }
  }

  return parceiros
    .map((parceiro) => {
      const horasAlocadas = horasPorParceiro.get(parceiro.id) ?? 0;
      const horasDisponiveis = (parceiro.disponibilidade_horas_semana ?? 0) * SEMANAS_POR_MES;
      return {
        id: parceiro.id,
        nome: parceiro.nome,
        horasAlocadas,
        horasDisponiveis,
        percentualUtilizacao: horasDisponiveis > 0 ? Math.min((horasAlocadas / horasDisponiveis) * 100, 100) : 0,
      };
    })
    .filter((p) => p.horasAlocadas > 0)
    .sort((a, b) => b.horasAlocadas - a.horasAlocadas)
    .slice(0, 5);
}
