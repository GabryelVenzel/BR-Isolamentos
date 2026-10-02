import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { HistoricoServicoRepository, ServicoRepository } from "../../repositories";
import type { HistoricoServico, Servico } from "../../types/domain";
import { FinalizarServicoSchema, parseOrThrow } from "../../validators";

/** Checklist de finalização (regra do pedido — "não deixa finalizar sem
 * fotos + PDF"): fotos do projeto (pelo menos 1, ver `fotos_url` — modelo
 * unificado, sql-migration-013) e PDF relatório precisam já ter sido
 * anexados (via PATCH normal do serviço, upload feito no cliente antes de
 * chamar isto — ver ServicoDetailModal.tsx) ANTES de chamar este use case.
 * `valor_real` é OPCIONAL (pedido explícito — antes bloqueava finalizar,
 * agora não; ver FinalizarServicoSchema).
 *
 * NÃO cria mais um lançamento de receita sozinho (pedido explícito, rodada
 * "categorias de receita por tipo de serviço"): com a receita agora
 * dividida em 6 categorias específicas (M.O. Fixo Quente/Frio, Material e
 * M.O. Fixo Quente/Frio, M.O. Removível, M.O. Delineamento — ver migração
 * 036), não existe mais 1 categoria genérica óbvia pra preencher sozinho, e
 * nenhuma delas é derivável automaticamente a partir dos dados do serviço.
 * O lançamento de receita da venda passa a ser sempre criado manualmente
 * (aba Lançamentos), escolhendo a categoria certa caso a caso. */
export async function finalizarServico(
  servicoId: string,
  input: unknown,
  repos: { servicoRepo: ServicoRepository; historicoRepo: HistoricoServicoRepository },
  usuarioEmail?: string | null
): Promise<Servico> {
  const dados = parseOrThrow(FinalizarServicoSchema, input);

  const servico = await repos.servicoRepo.findById(servicoId);
  if (!servico) throw new NotFoundError(`Serviço ${servicoId} não encontrado.`);
  if (servico.etapa === "finalizado") {
    throw new ConflictError("Este serviço já foi finalizado.");
  }

  const faltando: string[] = [];
  if (servico.fotos_url.length === 0) faltando.push("fotos do projeto");
  if (!servico.pdf_relatorio_url) faltando.push("PDF relatório");
  if (faltando.length > 0) {
    throw new ValidationError(`Não é possível finalizar: faltam ${faltando.join(" e ")}.`);
  }

  // Brasília (UTC-3): "hoje" calculado a partir do instante UTC do servidor,
  // convertido pro fuso de Brasília antes de extrair a data — evita que um
  // serviço finalizado à noite (BRT) grave a data de amanhã (UTC já virou o
  // dia seguinte).
  const dataFimReal = dados.data_fim_real ?? obterDataHojeBrasilia();
  const valorReal = dados.valor_real ?? null;

  const atualizado = await repos.servicoRepo.update(servicoId, {
    etapa: "finalizado",
    valor_real: valorReal,
    data_fim_real: dataFimReal,
  } as Partial<Servico>);

  await repos.historicoRepo.create({
    servico_id: servicoId,
    tipo_evento: "finalizacao",
    etapa_anterior: servico.etapa,
    etapa_nova: "finalizado",
    descricao: valorReal != null ? `Serviço finalizado — valor real: ${valorReal}.` : "Serviço finalizado.",
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoServico>);

  return atualizado;
}

function obterDataHojeBrasilia(): string {
  // "en-CA" formata como YYYY-MM-DD — mais direto que montar a string na mão.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
