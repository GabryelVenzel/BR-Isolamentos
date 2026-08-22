import { ValidationError } from "../../errors";
import type { AgendamentoRepository, OrcamentoRepository, ParceiroRepository } from "../../repositories";
import type { Agendamento } from "../../types/domain";
import { CreateAgendamentoSchema, parseOrThrow } from "../../validators";

export async function criarAgendamento(
  input: unknown,
  repos: { agendamentoRepo: AgendamentoRepository; orcamentoRepo: OrcamentoRepository; parceiroRepo: ParceiroRepository }
): Promise<Agendamento> {
  const dados = parseOrThrow(CreateAgendamentoSchema, input);

  if (dados.orcamento_id) {
    const orcamento = await repos.orcamentoRepo.findById(dados.orcamento_id);
    if (!orcamento) throw new ValidationError(`Orçamento ${dados.orcamento_id} não encontrado.`);
  }

  // Integridade dos ids em `parceiros_alocados` não é garantida por FK no
  // banco (Postgres não tem "foreign key de array" — ver comentário em
  // sql-migration-004-6modulos-completo.sql), então validamos aqui: cada id
  // precisa corresponder a um parceiro cadastrado.
  for (const parceiroId of dados.parceiros_alocados ?? []) {
    const parceiro = await repos.parceiroRepo.findById(parceiroId);
    if (!parceiro) throw new ValidationError(`Parceiro ${parceiroId} não encontrado.`);
  }

  return repos.agendamentoRepo.create(dados as Partial<Agendamento>);
}
