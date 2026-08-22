import { NotFoundError } from "../../errors";
import type { LeadRepository } from "../../repositories";
import type { Lead } from "../../types/domain";
import { UpdateLeadSchema, parseOrThrow } from "../../validators";

/** Atualiza campos "de cadastro" do lead (valor, origem, notas, responsável,
 * tags...). Mudança de `etapa` e de `temperatura` sempre passam por use
 * cases dedicados (`moverLead`, `mudarTemperatura`) — ambos gravam entrada no
 * histórico e, no caso de temperatura, podem agendar reativação. Por isso o
 * schema de update aqui ignora os dois campos mesmo que venham no corpo: se
 * passassem direto por aqui, essa mudança de estado ficaria invisível na
 * timeline do lead. */
export async function atualizarLead(
  id: string,
  dados: unknown,
  repos: { leadRepo: LeadRepository }
): Promise<Lead> {
  const existente = await repos.leadRepo.findById(id);
  if (!existente) throw new NotFoundError(`Lead ${id} não encontrado.`);

  const validados = parseOrThrow(UpdateLeadSchema, dados);
  const { etapa: _etapa, temperatura: _temperatura, ...camposPermitidos } = validados;

  return repos.leadRepo.update(id, camposPermitidos as Partial<Lead>);
}
