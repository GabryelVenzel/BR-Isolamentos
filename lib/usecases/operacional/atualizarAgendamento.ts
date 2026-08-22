import { NotFoundError } from "../../errors";
import type { AgendamentoRepository } from "../../repositories";
import type { Agendamento } from "../../types/domain";
import { UpdateAgendamentoSchema, parseOrThrow } from "../../validators";

export async function atualizarAgendamento(
  id: string,
  dados: unknown,
  repos: { agendamentoRepo: AgendamentoRepository }
): Promise<Agendamento> {
  const existente = await repos.agendamentoRepo.findById(id);
  if (!existente) throw new NotFoundError(`Agendamento ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateAgendamentoSchema, dados);
  return repos.agendamentoRepo.update(id, validados as Partial<Agendamento>);
}
