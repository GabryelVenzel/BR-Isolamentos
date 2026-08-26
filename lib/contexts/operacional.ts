// Contexto de negócio do módulo Operacional (parceiros, fornecedores, agenda
// de execução, serviços/obras, capacidade, relatórios). Ponto único de
// import para telas e API routes — reúne os repositórios e os use cases de
// `lib/usecases/operacional` atrás de uma fachada injetada com o client do
// Supabase da requisição atual. Mesmo padrão de `lib/contexts/comercial.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AgendamentoRepository,
  FornecedorAnexoRepository,
  FornecedorRepository,
  HistoricoServicoRepository,
  InteracaoServicoRepository,
  LancamentoFinanceiroRepository,
  LeadRepository,
  OrcamentoRepository,
  ParceiroAnexoRepository,
  ParceiroRepository,
  ServicoParceiroExecucaoRepository,
  ServicoRepository,
  type FiltrosAgendamento,
  type FiltrosFornecedor,
  type FiltrosParceiro,
  type FiltrosServico,
} from "../repositories";
import type {
  Agendamento,
  EtapaServico,
  Fornecedor,
  FornecedorAnexo,
  HistoricoServico,
  InteracaoServico,
  Parceiro,
  ParceiroAnexo,
  Servico,
  ServicoParceiroExecucao,
} from "../types/domain";
import {
  adicionarParceiroServico,
  anexarArquivoFornecedor,
  anexarArquivoParceiro,
  anexarArquivoServico,
  removerArquivoServico,
  atualizarAgendamento,
  atualizarFornecedor,
  atualizarParceiro,
  atualizarServico,
  calcularCapacidadeDia,
  calcularCapacidadeMes,
  criarAgendamento,
  criarFornecedor,
  criarParceiro,
  criarServico,
  finalizarServico,
  gerarRelatorioOperacional,
  moverServico,
  registrarInteracaoServico,
  type CapacidadeDia,
  type CapacidadeResumoDia,
  type RelatorioOperacional,
} from "../usecases/operacional";

export function createOperacionalContext(supabase: SupabaseClient) {
  const parceiroRepo = new ParceiroRepository(supabase);
  const fornecedorRepo = new FornecedorRepository(supabase);
  const agendamentoRepo = new AgendamentoRepository(supabase);
  const orcamentoRepo = new OrcamentoRepository(supabase);
  const leadRepo = new LeadRepository(supabase);
  const servicoRepo = new ServicoRepository(supabase);
  const historicoServicoRepo = new HistoricoServicoRepository(supabase);
  const interacaoServicoRepo = new InteracaoServicoRepository(supabase);
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);
  const execucaoRepo = new ServicoParceiroExecucaoRepository(supabase);
  const parceiroAnexoRepo = new ParceiroAnexoRepository(supabase);
  const fornecedorAnexoRepo = new FornecedorAnexoRepository(supabase);

  const reposServico = { servicoRepo, historicoRepo: historicoServicoRepo };
  // finalizarServico usa `lancamentoRepo` além dos dois de cima — separado
  // aqui porque moverServico (que também usa `reposServico`) não precisa
  // dele, e passar um repositório extra sem uso é ruído.
  const reposFinalizarServico = { servicoRepo, historicoRepo: historicoServicoRepo, lancamentoRepo };
  const reposCriarServico = { servicoRepo, historicoRepo: historicoServicoRepo, leadRepo, orcamentoRepo };

  return {
    parceiroRepo,
    fornecedorRepo,
    agendamentoRepo,
    servicoRepo,
    historicoServicoRepo,
    interacaoServicoRepo,

    // --- Parceiros ---

    listarParceiros(filtros?: FiltrosParceiro): Promise<Parceiro[]> {
      return parceiroRepo.listar(filtros);
    },

    buscarParceiro(id: string): Promise<Parceiro> {
      return parceiroRepo.findByIdOrThrow(id);
    },

    criarParceiro(dados: unknown): Promise<Parceiro> {
      return criarParceiro(dados, { parceiroRepo });
    },

    atualizarParceiro(id: string, dados: unknown): Promise<Parceiro> {
      return atualizarParceiro(id, dados, { parceiroRepo });
    },

    removerParceiro(id: string): Promise<void> {
      return parceiroRepo.delete(id);
    },

    // --- Anexos de parceiro (só disponível editando, ver ParceiroAnexos.tsx) ---

    listarAnexosParceiro(parceiroId: string): Promise<ParceiroAnexo[]> {
      return parceiroAnexoRepo.listarPorParceiro(parceiroId);
    },

    anexarArquivoParceiro(dados: unknown): Promise<ParceiroAnexo> {
      return anexarArquivoParceiro(dados, { parceiroRepo, parceiroAnexoRepo });
    },

    removerAnexoParceiro(anexoId: string): Promise<void> {
      return parceiroAnexoRepo.delete(anexoId);
    },

    // --- Fornecedores ---

    listarFornecedores(filtros?: FiltrosFornecedor): Promise<Fornecedor[]> {
      return fornecedorRepo.listar(filtros);
    },

    buscarFornecedor(id: string): Promise<Fornecedor> {
      return fornecedorRepo.findByIdOrThrow(id);
    },

    criarFornecedor(dados: unknown): Promise<Fornecedor> {
      return criarFornecedor(dados, { fornecedorRepo });
    },

    atualizarFornecedor(id: string, dados: unknown): Promise<Fornecedor> {
      return atualizarFornecedor(id, dados, { fornecedorRepo });
    },

    removerFornecedor(id: string): Promise<void> {
      return fornecedorRepo.delete(id);
    },

    // --- Anexos de fornecedor (só disponível editando, ver FornecedorAnexos.tsx) ---

    listarAnexosFornecedor(fornecedorId: string): Promise<FornecedorAnexo[]> {
      return fornecedorAnexoRepo.listarPorFornecedor(fornecedorId);
    },

    anexarArquivoFornecedor(dados: unknown): Promise<FornecedorAnexo> {
      return anexarArquivoFornecedor(dados, { fornecedorRepo, fornecedorAnexoRepo });
    },

    removerAnexoFornecedor(anexoId: string): Promise<void> {
      return fornecedorAnexoRepo.delete(anexoId);
    },

    // --- Agenda (existente, inalterada) ---

    listarAgenda(filtros?: FiltrosAgendamento): Promise<Agendamento[]> {
      return agendamentoRepo.listar(filtros);
    },

    buscarAgendamento(id: string): Promise<Agendamento> {
      return agendamentoRepo.findByIdOrThrow(id);
    },

    criarAgendamento(dados: unknown): Promise<Agendamento> {
      return criarAgendamento(dados, { agendamentoRepo, orcamentoRepo, parceiroRepo });
    },

    atualizarAgendamento(id: string, dados: unknown): Promise<Agendamento> {
      return atualizarAgendamento(id, dados, { agendamentoRepo });
    },

    removerAgendamento(id: string): Promise<void> {
      return agendamentoRepo.delete(id);
    },

    // --- Serviços (Kanban de obras) ---

    listarServicos(filtros?: FiltrosServico): Promise<Servico[]> {
      return servicoRepo.listar(filtros);
    },

    buscarServico(id: string): Promise<Servico> {
      return servicoRepo.findByIdOrThrow(id);
    },

    criarServico(dados: unknown, usuarioEmail?: string | null): Promise<Servico> {
      return criarServico(dados, reposCriarServico, usuarioEmail);
    },

    atualizarServico(id: string, dados: unknown): Promise<Servico> {
      return atualizarServico(id, dados, { servicoRepo });
    },

    moverServico(servicoId: string, novaEtapa: EtapaServico, usuarioEmail?: string | null): Promise<Servico> {
      return moverServico({ servicoId, novaEtapa }, reposServico, usuarioEmail);
    },

    finalizarServico(servicoId: string, dados: unknown, usuarioEmail?: string | null): Promise<Servico> {
      return finalizarServico(servicoId, dados, reposFinalizarServico, usuarioEmail);
    },

    anexarArquivoServico(servicoId: string, dados: unknown, usuarioEmail?: string | null): Promise<Servico> {
      return anexarArquivoServico(servicoId, dados, reposServico, usuarioEmail);
    },

    removerArquivoServico(servicoId: string, dados: unknown, usuarioEmail?: string | null): Promise<Servico> {
      return removerArquivoServico(servicoId, dados, reposServico, usuarioEmail);
    },

    removerServico(id: string): Promise<void> {
      return servicoRepo.delete(id);
    },

    // --- Parceiros vinculados a um serviço (aba Parceiros, ver sql-migration-013) ---

    listarParceirosServico(servicoId: string): Promise<ServicoParceiroExecucao[]> {
      return execucaoRepo.listarPorServico(servicoId);
    },

    adicionarParceiroServico(dados: unknown): Promise<ServicoParceiroExecucao> {
      return adicionarParceiroServico(dados, { servicoRepo, parceiroRepo, execucaoRepo });
    },

    removerParceiroServico(execucaoId: string): Promise<void> {
      return execucaoRepo.delete(execucaoId);
    },

    listarHistoricoServico(servicoId: string): Promise<HistoricoServico[]> {
      return historicoServicoRepo.listarPorServico(servicoId);
    },

    listarInteracoesServico(servicoId: string): Promise<InteracaoServico[]> {
      return interacaoServicoRepo.listarPorServico(servicoId);
    },

    registrarInteracaoServico(dados: unknown): Promise<InteracaoServico> {
      return registrarInteracaoServico(dados, { servicoRepo, interacaoRepo: interacaoServicoRepo });
    },

    listarServicosPorParceiro(parceiroId: string): Promise<Servico[]> {
      return servicoRepo.listarPorParceiro(parceiroId);
    },

    // --- Capacidade ---

    async obterCapacidadeDia(data: string): Promise<CapacidadeDia> {
      const [parceiros, servicosAtivos] = await Promise.all([
        parceiroRepo.listar({ ativo: true }),
        servicoRepo.listarAtivosNoDia(data),
      ]);
      return calcularCapacidadeDia(data, parceiros, servicosAtivos);
    },

    /** Resumo dia-a-dia do mês inteiro (grid de cor do calendário da Agenda) —
     * uma query pro mês inteiro, não uma por dia. */
    async obterCapacidadeMes(ano: number, mes: number): Promise<CapacidadeResumoDia[]> {
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

      const [parceiros, servicosDoMes] = await Promise.all([
        parceiroRepo.listar({ ativo: true }),
        servicoRepo.listarAtivosNoIntervalo(dataInicio, dataFim),
      ]);
      return calcularCapacidadeMes(ano, mes, parceiros, servicosDoMes);
    },

    // --- Relatórios ---

    async gerarRelatorio(filtros: { criadosApartirDe?: string; tipoTrabalho?: string; responsavelEmail?: string }): Promise<RelatorioOperacional> {
      const servicos = await servicoRepo.listar(filtros);
      return gerarRelatorioOperacional(servicos);
    },
  };
}

export type OperacionalContext = ReturnType<typeof createOperacionalContext>;
