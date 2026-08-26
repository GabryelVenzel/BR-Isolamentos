import { NotFoundError } from "../../errors";
import type { ParceiroRepository, ServicoParceiroExecucaoRepository, ServicoRepository } from "../../repositories";
import type { ServicoParceiroExecucao } from "../../types/domain";
import { CreateServicoParceiroExecucaoSchema, parseOrThrow } from "../../validators";

/** Vincula um parceiro a um serviço com seu próprio headcount ("pessoas
 * mobilizadas") e tipos de trabalho — substitui o antigo "parceiro
 * principal" único (ver sql-migration-013). Um serviço pode ter N parceiros;
 * nada impede vincular o mesmo parceiro duas vezes (ex.: turnos diferentes),
 * então não há checagem de duplicidade aqui — quem decide isso é quem usa a
 * tela (ServicoDetailModal.tsx). */
export async function adicionarParceiroServico(
  input: unknown,
  repos: { servicoRepo: ServicoRepository; parceiroRepo: ParceiroRepository; execucaoRepo: ServicoParceiroExecucaoRepository }
): Promise<ServicoParceiroExecucao> {
  const dados = parseOrThrow(CreateServicoParceiroExecucaoSchema, input);

  const servico = await repos.servicoRepo.findById(dados.servico_id);
  if (!servico) throw new NotFoundError(`Serviço ${dados.servico_id} não encontrado.`);

  const parceiro = await repos.parceiroRepo.findById(dados.parceiro_id);
  if (!parceiro) throw new NotFoundError(`Parceiro ${dados.parceiro_id} não encontrado.`);

  return repos.execucaoRepo.create(dados as Partial<ServicoParceiroExecucao>);
}
