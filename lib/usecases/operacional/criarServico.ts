import { NotFoundError } from "../../errors";
import type { HistoricoServicoRepository, LeadRepository, OrcamentoRepository, ServicoRepository } from "../../repositories";
import type { HistoricoServico, Servico } from "../../types/domain";
import { CreateServicoSchema, parseOrThrow } from "../../validators";

/** Cria um serviço a partir de um lead (normalmente fechado, mas não força
 * essa checagem aqui — quem decide QUANDO oferecer "criar serviço" é a UI do
 * Comercial, ver LeadDetailModal.tsx). `cliente_id`, `numero_lead`,
 * `numero_orcamento` e `valor_orcado` são carregados do lead/orçamento
 * vinculados, não pedidos de novo ao usuário — é exatamente o ponto da
 * rastreabilidade Lead→Orçamento→Serviço. */
export async function criarServico(
  input: unknown,
  repos: {
    servicoRepo: ServicoRepository;
    historicoRepo: HistoricoServicoRepository;
    leadRepo: LeadRepository;
    orcamentoRepo: OrcamentoRepository;
  },
  usuarioEmail?: string | null
): Promise<Servico> {
  const dados = parseOrThrow(CreateServicoSchema, input);

  const lead = await repos.leadRepo.findById(dados.lead_id);
  if (!lead) throw new NotFoundError(`Lead ${dados.lead_id} não encontrado.`);

  const orcamento = await repos.orcamentoRepo.findById(dados.orcamento_id);
  if (!orcamento) throw new NotFoundError(`Orçamento ${dados.orcamento_id} não encontrado.`);

  const servico = await repos.servicoRepo.create({
    lead_id: dados.lead_id,
    numero_lead: lead.numero_lead,
    orcamento_id: dados.orcamento_id,
    numero_orcamento: orcamento.numero_orcamento,
    cliente_id: lead.cliente_id,
    tipos_trabalho: dados.tipos_trabalho,
    // Espelha o primeiro tipo selecionado — mantém compatibilidade com
    // filtros/relatórios que ainda agrupam por um tipo só (ver decisão em
    // sql-migration-011-servicos-multiplos-tipos.sql).
    tipo_trabalho: dados.tipos_trabalho[0],
    valor_orcado: orcamento.valor_final,
    parceiro_principal_id: dados.parceiro_principal_id,
    pessoas_alocadas: dados.pessoas_alocadas ?? null,
    parceiros_alocados: dados.parceiros_alocados ?? [],
    data_inicio: dados.data_inicio,
    data_fim_prevista: dados.data_fim_prevista ?? null,
    descricao: dados.descricao ?? null,
    notas: dados.notas ?? null,
    responsavel_email: dados.responsavel_email ?? usuarioEmail ?? null,
    etapa: "planejamento",
  } as Partial<Servico>);

  await repos.historicoRepo.create({
    servico_id: servico.id,
    tipo_evento: "criacao",
    etapa_nova: "planejamento",
    descricao: `Serviço criado a partir do lead ${lead.numero_lead ?? lead.id}.`,
    usuario_email: usuarioEmail ?? null,
  } as Partial<HistoricoServico>);

  return servico;
}
