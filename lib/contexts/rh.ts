// Contexto de negócio do módulo RH (migração 033) — documentos da empresa e
// cadastro de funcionários com seus anexos. Ponto único de import para telas
// e API routes — mesmo padrão de lib/contexts/operacional.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError } from "../errors";
import { hojeBrasilia } from "../financeiro";
import { listaDocumentosObrigatorios, listaTiposDocumento, situacaoDocumentacao, type DocumentoObrigatorioEmpresa, type TipoDocumentoRh } from "../rh";
import {
  DocumentoEmpresaRepository,
  FuncionarioAnexoRepository,
  FuncionarioAusenciaRepository,
  FuncionarioDadosRepository,
  FuncionarioEpiRepository,
  FuncionarioRepository,
  type FiltrosFuncionario,
} from "../repositories";
import type {
  DocumentoEmpresa,
  Funcionario,
  FuncionarioAnexo,
  FuncionarioAusencia,
  FuncionarioDados,
  FuncionarioEpi,
  LancamentoFinanceiro,
} from "../types/domain";
import { ConfigRhSchema, CreateAusenciaSchema, CreateEpiSchema, UpdateEpiSchema, parseOrThrow } from "../validators";
import {
  anexarArquivoFuncionario,
  anexarDocumentoEmpresa,
  atualizarFuncionario,
  criarFuncionario,
  renomearAnexoFuncionario,
  renomearDocumentoEmpresa,
} from "../usecases/rh";

export function createRhContext(supabase: SupabaseClient) {
  const documentoEmpresaRepo = new DocumentoEmpresaRepository(supabase);
  const funcionarioRepo = new FuncionarioRepository(supabase);
  const funcionarioAnexoRepo = new FuncionarioAnexoRepository(supabase);
  const funcionarioDadosRepo = new FuncionarioDadosRepository(supabase);
  const epiRepo = new FuncionarioEpiRepository(supabase);
  const ausenciaRepo = new FuncionarioAusenciaRepository(supabase);

  /** Antecedência do aviso "vence em N dias" (a mesma dos alertas). */
  async function diasAvisoDocumentos(): Promise<number> {
    const { data } = await supabase.from("config_alertas").select("dias_documentos_a_vencer").eq("id", 1).maybeSingle();
    return Number((data as { dias_documentos_a_vencer?: number } | null)?.dias_documentos_a_vencer) || 30;
  }

  return {
    // --- Configurações do RH (migração 052) ---

    async obterConfigRh(): Promise<{ tiposDocumento: TipoDocumentoRh[]; obrigatorios: DocumentoObrigatorioEmpresa[]; diasAviso: number }> {
      const [{ data, error }, diasAviso] = await Promise.all([
        supabase.from("config_empresa").select("*").limit(1).maybeSingle(),
        diasAvisoDocumentos(),
      ]);
      if (error) throw error;
      const cfg = (data ?? {}) as { rh_tipos_documento?: unknown; rh_documentos_obrigatorios?: unknown };
      return { tiposDocumento: listaTiposDocumento(cfg.rh_tipos_documento), obrigatorios: listaDocumentosObrigatorios(cfg.rh_documentos_obrigatorios), diasAviso };
    },

    async salvarConfigRh(input: unknown): Promise<void> {
      const dados = parseOrThrow(ConfigRhSchema, input);
      const { data: atual, error: erroAtual } = await supabase.from("config_empresa").select("id").limit(1).maybeSingle();
      if (erroAtual) throw erroAtual;
      if (!atual) throw new NotFoundError("Configuração da empresa não encontrada.");
      const { error } = await supabase.from("config_empresa").update(dados).eq("id", (atual as { id: number }).id);
      if (error) throw error;
    },
    // --- Documentos da empresa (lista solta) ---

    listarDocumentosEmpresa(): Promise<DocumentoEmpresa[]> {
      return documentoEmpresaRepo.listar();
    },

    /** Todas as versões de um documento (a atual e as anteriores). */
    async listarVersoesDocumentoEmpresa(id: string): Promise<DocumentoEmpresa[]> {
      const documento = await documentoEmpresaRepo.findByIdOrThrow(id);
      return documento.grupo_id ? documentoEmpresaRepo.listarVersoes(documento.grupo_id) : [documento];
    },

    anexarDocumentoEmpresa(dados: unknown): Promise<DocumentoEmpresa> {
      return anexarDocumentoEmpresa(dados, { documentoEmpresaRepo });
    },

    renomearDocumentoEmpresa(id: string, dados: unknown): Promise<DocumentoEmpresa> {
      return renomearDocumentoEmpresa(id, dados, { documentoEmpresaRepo });
    },

    /** Exclui ESTA versão; se houver versão anterior, a mais recente delas
     * volta a ser a atual (migração 052). */
    async removerDocumentoEmpresa(id: string): Promise<void> {
      const documento = await documentoEmpresaRepo.findByIdOrThrow(id);
      await documentoEmpresaRepo.delete(id);
      if (documento.arquivado_em || !documento.grupo_id) return;
      const anterior = (await documentoEmpresaRepo.listarVersoes(documento.grupo_id)).find((v) => v.arquivado_em);
      if (anterior) await documentoEmpresaRepo.update(anterior.id, { arquivado_em: null } as Partial<DocumentoEmpresa>);
    },

    // --- Funcionários ---

    /** Lista com a situação da documentação de cada um e quem está
     * ausente hoje (férias, atestado...). */
    async listarFuncionarios(filtros?: FiltrosFuncionario): Promise<Funcionario[]> {
      const hoje = hojeBrasilia();
      const [funcionarios, documentos, ausencias, diasAviso] = await Promise.all([
        funcionarioRepo.listar(filtros),
        funcionarioAnexoRepo.listarResumo().catch(() => []),
        ausenciaRepo.listarAPartirDe(hoje),
        diasAvisoDocumentos(),
      ]);
      return funcionarios.map((f) => {
        const ausente = ausencias.find((a) => a.funcionario_id === f.id && a.inicio <= hoje && a.fim >= hoje);
        return {
          ...f,
          documentacao: situacaoDocumentacao(documentos.filter((d) => d.funcionario_id === f.id), hoje, diasAviso),
          ausente_hoje: ausente ? { tipo: ausente.tipo, fim: ausente.fim } : null,
        };
      });
    },

    /** Ficha completa: cadastro + dados sensíveis (vazios se ainda não há). */
    async buscarFuncionario(id: string): Promise<Funcionario & { dados: FuncionarioDados | null }> {
      const [funcionario, dados] = await Promise.all([funcionarioRepo.findByIdOrThrow(id), funcionarioDadosRepo.buscar(id).catch(() => null)]);
      return { ...funcionario, dados };
    },

    criarFuncionario(dados: unknown): Promise<Funcionario> {
      return criarFuncionario(dados, { funcionarioRepo, funcionarioDadosRepo });
    },

    atualizarFuncionario(id: string, dados: unknown): Promise<Funcionario> {
      return atualizarFuncionario(id, dados, { funcionarioRepo, funcionarioDadosRepo });
    },

    // --- EPI (migração 052) ---

    listarEpis(funcionarioId: string): Promise<FuncionarioEpi[]> {
      return epiRepo.listarPorFuncionario(funcionarioId);
    },

    async registrarEpi(funcionarioId: string, input: unknown, usuarioEmail: string | null): Promise<FuncionarioEpi> {
      await funcionarioRepo.findByIdOrThrow(funcionarioId);
      const dados = parseOrThrow(CreateEpiSchema, input);
      return epiRepo.create({ ...dados, funcionario_id: funcionarioId, registrado_por: usuarioEmail } as Partial<FuncionarioEpi>);
    },

    atualizarEpi(id: string, input: unknown): Promise<FuncionarioEpi> {
      return epiRepo.update(id, parseOrThrow(UpdateEpiSchema, input) as Partial<FuncionarioEpi>);
    },

    removerEpi(id: string): Promise<void> {
      return epiRepo.delete(id);
    },

    // --- Férias e afastamentos (migração 052) ---

    listarAusencias(funcionarioId: string): Promise<FuncionarioAusencia[]> {
      return ausenciaRepo.listarPorFuncionario(funcionarioId);
    },

    async registrarAusencia(funcionarioId: string, input: unknown, usuarioEmail: string | null): Promise<FuncionarioAusencia> {
      await funcionarioRepo.findByIdOrThrow(funcionarioId);
      const dados = parseOrThrow(CreateAusenciaSchema, input);
      return ausenciaRepo.create({ ...dados, funcionario_id: funcionarioId, registrado_por: usuarioEmail } as Partial<FuncionarioAusencia>);
    },

    removerAusencia(id: string): Promise<void> {
      return ausenciaRepo.delete(id);
    },

    // --- Pagamentos e obras (migração 052) ---

    /** O que o funcionário recebeu e onde trabalhou: lançamentos ligados a
     * ele (salário, pró-labore, adiantamento — só os que o usuário pode ler),
     * diárias apontadas nas obras e obras em que foi alocado. */
    async historicoFuncionario(funcionarioId: string): Promise<{
      lancamentos: Array<Pick<LancamentoFinanceiro, "id" | "tipo" | "categoria" | "descricao" | "valor" | "data" | "pago" | "data_pagamento">>;
      diarias: Array<{ id: string; data: string; valor: number; pago?: boolean | null; servico: { id: string; numero_servico: string } | null }>;
      obras: Array<{ id: string; numero_servico: string; etapa: string; data_inicio: string | null; data_fim_prevista: string | null; cliente: string | null; funcoes: string[] }>;
    }> {
      const [lancamentos, diarias, obras] = await Promise.all([
        supabase
          .from("lancamentos_financeiros")
          .select("id, tipo, categoria, descricao, valor, data, pago, data_pagamento")
          .eq("funcionario_id", funcionarioId)
          .is("excluido_em", null)
          .order("data", { ascending: false })
          .then((r) => (r.error ? [] : r.data ?? [])),
        supabase
          .from("diarias")
          .select("*, servico:servicos(id, numero_servico)")
          .eq("funcionario_id", funcionarioId)
          .order("data", { ascending: false })
          .then((r) => (r.error ? [] : r.data ?? [])),
        supabase
          .from("servico_funcionarios_execucao")
          .select("tipos_trabalho, servico:servicos(id, numero_servico, etapa, data_inicio, data_fim_prevista, excluido_em, cliente:clientes(nome))")
          .eq("funcionario_id", funcionarioId)
          .then((r) => (r.error ? [] : r.data ?? [])),
      ]);
      return {
        lancamentos: lancamentos as never,
        diarias: diarias as never,
        obras: (obras as unknown as Array<{ tipos_trabalho: string[]; servico: { id: string; numero_servico: string; etapa: string; data_inicio: string | null; data_fim_prevista: string | null; excluido_em: string | null; cliente: { nome: string } | null } | null }>)
          .filter((o) => o.servico && !o.servico.excluido_em)
          .map((o) => ({
            id: o.servico!.id,
            numero_servico: o.servico!.numero_servico,
            etapa: o.servico!.etapa,
            data_inicio: o.servico!.data_inicio,
            data_fim_prevista: o.servico!.data_fim_prevista,
            cliente: o.servico!.cliente?.nome ?? null,
            funcoes: o.tipos_trabalho ?? [],
          })),
      };
    },

    removerFuncionario(id: string): Promise<void> {
      return funcionarioRepo.delete(id);
    },

    // --- Anexos de funcionário (N por pessoa, só na edição) ---

    listarAnexosFuncionario(funcionarioId: string): Promise<FuncionarioAnexo[]> {
      return funcionarioAnexoRepo.listarPorFuncionario(funcionarioId);
    },

    anexarArquivoFuncionario(dados: unknown): Promise<FuncionarioAnexo> {
      return anexarArquivoFuncionario(dados, { funcionarioRepo, funcionarioAnexoRepo });
    },

    renomearAnexoFuncionario(anexoId: string, dados: unknown): Promise<FuncionarioAnexo> {
      return renomearAnexoFuncionario(anexoId, dados, { funcionarioAnexoRepo });
    },

    removerAnexoFuncionario(anexoId: string): Promise<void> {
      return funcionarioAnexoRepo.delete(anexoId);
    },
  };
}

export type RhContext = ReturnType<typeof createRhContext>;
