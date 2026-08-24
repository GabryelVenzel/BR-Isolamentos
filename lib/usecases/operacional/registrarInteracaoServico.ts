import { NotFoundError } from "../../errors";
import type { InteracaoServicoRepository, ServicoRepository } from "../../repositories";
import type { InteracaoServico } from "../../types/domain";
import { CreateInteracaoServicoSchema, parseOrThrow } from "../../validators";

export async function registrarInteracaoServico(
  input: unknown,
  repos: { servicoRepo: ServicoRepository; interacaoRepo: InteracaoServicoRepository }
): Promise<InteracaoServico> {
  const dados = parseOrThrow(CreateInteracaoServicoSchema, input);

  const servico = await repos.servicoRepo.findById(dados.servico_id);
  if (!servico) throw new NotFoundError(`Serviço ${dados.servico_id} não encontrado.`);

  return repos.interacaoRepo.create(dados as Partial<InteracaoServico>);
}
