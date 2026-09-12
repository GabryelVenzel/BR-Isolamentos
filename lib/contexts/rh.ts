// Contexto de negócio do módulo RH (migração 033) — documentos da empresa e
// cadastro de funcionários com seus anexos. Ponto único de import para telas
// e API routes — mesmo padrão de lib/contexts/operacional.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DocumentoEmpresaRepository,
  FuncionarioAnexoRepository,
  FuncionarioRepository,
  type FiltrosFuncionario,
} from "../repositories";
import type { DocumentoEmpresa, Funcionario, FuncionarioAnexo } from "../types/domain";
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

  return {
    // --- Documentos da empresa (lista solta) ---

    listarDocumentosEmpresa(): Promise<DocumentoEmpresa[]> {
      return documentoEmpresaRepo.listar();
    },

    anexarDocumentoEmpresa(dados: unknown): Promise<DocumentoEmpresa> {
      return anexarDocumentoEmpresa(dados, { documentoEmpresaRepo });
    },

    renomearDocumentoEmpresa(id: string, dados: unknown): Promise<DocumentoEmpresa> {
      return renomearDocumentoEmpresa(id, dados, { documentoEmpresaRepo });
    },

    removerDocumentoEmpresa(id: string): Promise<void> {
      return documentoEmpresaRepo.delete(id);
    },

    // --- Funcionários ---

    listarFuncionarios(filtros?: FiltrosFuncionario): Promise<Funcionario[]> {
      return funcionarioRepo.listar(filtros);
    },

    buscarFuncionario(id: string): Promise<Funcionario> {
      return funcionarioRepo.findByIdOrThrow(id);
    },

    criarFuncionario(dados: unknown): Promise<Funcionario> {
      return criarFuncionario(dados, { funcionarioRepo });
    },

    atualizarFuncionario(id: string, dados: unknown): Promise<Funcionario> {
      return atualizarFuncionario(id, dados, { funcionarioRepo });
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
