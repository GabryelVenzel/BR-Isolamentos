import { NotFoundError } from "../../errors";
import type { ServicoRepository } from "../../repositories";
import type { Servico } from "../../types/domain";
import { UpdateServicoSchema, parseOrThrow } from "../../validators";

/** Atualiza campos "de cadastro" do serviço (tipo de trabalho, parceiros,
 * datas, notas...). Etapa passa por `moverServico` (grava histórico);
 * `valor_real`/`data_fim_real`/anexos passam por `finalizarServico`
 * (valida o checklist de finalização) — nenhum dos dois é aceito aqui. */
export async function atualizarServico(
  id: string,
  dados: unknown,
  repos: { servicoRepo: ServicoRepository }
): Promise<Servico> {
  const existente = await repos.servicoRepo.findById(id);
  if (!existente) throw new NotFoundError(`Serviço ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateServicoSchema, dados);
  const patch: Partial<Servico> = { ...validados };
  // Mesmo espelho de criarServico.ts — ver sql-migration-011.
  if (validados.tipos_trabalho) patch.tipo_trabalho = validados.tipos_trabalho[0];
  return repos.servicoRepo.update(id, patch);
}
