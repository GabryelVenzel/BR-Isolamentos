import { NotFoundError } from "../../errors";
import type { LeadRepository } from "../../repositories";
import type { Lead } from "../../types/domain";
import { UpdateLeadSchema, parseOrThrow } from "../../validators";

/** Atualiza campos "de cadastro" do lead (temperatura, valor, notas,
 * responsável, tags...). Mudança de `etapa` deve sempre passar por
 * `moverLead`, que aplica a regra de transição do funil — por isso o schema
 * de update aqui não valida `etapa` mesmo que venha no corpo (é ignorada). */
export async function atualizarLead(
  id: string,
  dados: unknown,
  repos: { leadRepo: LeadRepository }
): Promise<Lead> {
  const existente = await repos.leadRepo.findById(id);
  if (!existente) throw new NotFoundError(`Lead ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateLeadSchema, dados);
  const { etapa: _etapa, ...camposPermitidos } = validados;

  return repos.leadRepo.update(id, camposPermitidos as Partial<Lead>);
}
