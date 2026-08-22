import type { CustoFixoRepository } from "../../repositories";
import type { CustoFixo } from "../../types/domain";
import { CreateCustoFixoSchema, parseOrThrow } from "../../validators";

export async function criarCustoFixo(
  input: unknown,
  repos: { custoFixoRepo: CustoFixoRepository }
): Promise<CustoFixo> {
  const dados = parseOrThrow(CreateCustoFixoSchema, input);
  return repos.custoFixoRepo.create(dados as Partial<CustoFixo>);
}
