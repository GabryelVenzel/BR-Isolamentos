import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { HistoricoServicoRepository, ServicoRepository } from "../../repositories";
import type { HistoricoServico, Servico } from "../../types/domain";
import { FinalizarServicoSchema, parseOrThrow } from "../../validators";

/** Checklist de finalização (regra do pedido — "não deixa finalizar sem foto
 * + PDF"): foto principal e PDF relatório precisam já ter sido anexados
 * (via PATCH normal do serviço, upload feito no cliente antes de chamar
 * isto — ver ServicoDetailModal.tsx) ANTES de chamar este use case; valor
 * real vem no corpo desta chamada. Os 4 requisitos são checados juntos
 * aqui, não espalhados — evita finalizar com só 3 de 4 prontos. */
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
  if (!servico.foto_principal_url) faltando.push("foto principal");
  if (!servico.pdf_relatorio_url) faltando.push("PDF relatório");
  if (faltando.length > 0) {
    throw new ValidationError(`Não é possível finalizar: faltam ${faltando.join(" e ")}.`);
  }

  // Brasília (UTC-3): "hoje" calculado a partir do instante UTC do servidor,
  // convertido pro fuso de Brasília antes de extrair a data — evita que um
  // serviço finalizado à noite (BRT) grave a data de amanhã (UTC já virou o
  // dia seguinte).
  const dataFimReal = dados.data_fim_real ?? obterDataHojeBrasilia();

  const atualizado = await repos.servicoRepo.update(servicoId, {
    etapa: "finalizado",
    valor_real: dados.valor_real,
    data_fim_real: dataFimReal,
  } as Partial<Servico>);

  await repos.historicoRepo.create({
    servico_id: servicoId,
    tipo_evento: "finalizacao",
    etapa_anterior: servico.etapa,
    etapa_nova: "finalizado",
    descricao: `Serviço finalizado — valor real: ${dados.valor_real}.`,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoServico>);

  return atualizado;
}

function obterDataHojeBrasilia(): string {
  // "en-CA" formata como YYYY-MM-DD — mais direto que montar a string na mão.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
