// Central de pendências: busca os dados de cada módulo que o usuário tem
// liberado e aplica as regras de lib/alertas.ts. Calculado na hora, com o
// cliente da sessão — as regras de acesso do banco valem aqui também, então
// ninguém recebe alerta de um módulo que não enxerga.

import type { SupabaseClient } from "@supabase/supabase-js";
import { podeAcessarModulo, type Acesso } from "../acesso";
import {
  CONFIG_ALERTAS_PADRAO,
  alertasDocumentos,
  alertasFinanceiros,
  alertasObras,
  ordenarAlertas,
  type Alerta,
  type ConfigAlertas,
} from "../alertas";
import { hojeBrasilia } from "../financeiro";
import { logger } from "../logger";
import { DocumentoEmpresaRepository, FuncionarioAnexoRepository, LancamentoFinanceiroRepository, ServicoRepository } from "../repositories";
import { calcularResultadoPorObra } from "../usecases/financeiro";
import { ValidationError } from "../errors";

export interface CentralDeAlertas {
  alertas: Alerta[];
  config: ConfigAlertas;
}

export function createAlertasContext(supabase: SupabaseClient) {
  const lancamentoRepo = new LancamentoFinanceiroRepository(supabase);
  const servicoRepo = new ServicoRepository(supabase);
  const funcionarioAnexoRepo = new FuncionarioAnexoRepository(supabase);
  const documentoEmpresaRepo = new DocumentoEmpresaRepository(supabase);

  /** Prazos de antecedência (tabela `config_alertas`, migração 042). */
  async function config(): Promise<ConfigAlertas> {
    const { data, error } = await supabase.from("config_alertas").select("dias_contas_a_vencer, dias_documentos_a_vencer").eq("id", 1).maybeSingle();
    if (error || !data) return CONFIG_ALERTAS_PADRAO;
    return data as ConfigAlertas;
  }

  /** Um módulo com erro não derruba os alertas dos outros. */
  async function tentar(modulo: string, buscar: () => Promise<Alerta[]>): Promise<Alerta[]> {
    try {
      return await buscar();
    } catch (error) {
      logger.error(`Falha ao calcular alertas de ${modulo}`, error);
      return [];
    }
  }

  return {
    config,

    async atualizarConfig(dados: unknown): Promise<ConfigAlertas> {
      const corpo = (typeof dados === "object" && dados !== null ? dados : {}) as Record<string, unknown>;
      const contas = Number(corpo.dias_contas_a_vencer);
      const documentos = Number(corpo.dias_documentos_a_vencer);
      if (!Number.isInteger(contas) || contas < 0 || contas > 90) throw new ValidationError("Prazo de contas: informe de 0 a 90 dias.");
      if (!Number.isInteger(documentos) || documentos < 0 || documentos > 365) throw new ValidationError("Prazo de documentos: informe de 0 a 365 dias.");

      const { data, error } = await supabase
        .from("config_alertas")
        .update({ dias_contas_a_vencer: contas, dias_documentos_a_vencer: documentos, updated_at: new Date().toISOString() })
        .eq("id", 1)
        .select("dias_contas_a_vencer, dias_documentos_a_vencer")
        .single();
      if (error) throw error;
      return data as ConfigAlertas;
    },

    async listar(acesso: Acesso): Promise<CentralDeAlertas> {
      const cfg = await config();
      const hoje = hojeBrasilia();

      const [financeiro, rh, obras] = await Promise.all([
        podeAcessarModulo(acesso, "financeiro")
          ? tentar("financeiro", async () => alertasFinanceiros(await lancamentoRepo.listar({ pago: false }), hoje, cfg.dias_contas_a_vencer))
          : [],

        podeAcessarModulo(acesso, "rh")
          ? tentar("rh", async () => {
              const [deFuncionarios, daEmpresa] = await Promise.all([funcionarioAnexoRepo.listarComValidade(), documentoEmpresaRepo.listar()]);
              return alertasDocumentos(
                [...deFuncionarios, ...daEmpresa.map((d) => ({ nome: d.nome, validade: d.validade, funcionario: null }))],
                hoje,
                cfg.dias_documentos_a_vencer
              );
            })
          : [],

        podeAcessarModulo(acesso, "operacional")
          ? tentar("operacional", async () => {
              const [servicos, lancamentos] = await Promise.all([servicoRepo.listar(), lancamentoRepo.listarLigadosAObras()]);
              const resultados = new Map(calcularResultadoPorObra(servicos, lancamentos).map((r) => [r.servicoId, r]));
              return alertasObras(
                servicos.map((s) => ({
                  id: s.id,
                  numero: s.numero_servico,
                  cliente: s.cliente?.nome ?? null,
                  etapa: s.etapa,
                  data_fim_prevista: s.data_fim_prevista,
                  orcado: s.valor_orcado ?? 0,
                  receita: resultados.get(s.id)?.receita ?? 0,
                  despesa: resultados.get(s.id)?.despesa ?? 0,
                })),
                hoje
              );
            })
          : [],
      ]);

      return { alertas: ordenarAlertas([...financeiro, ...rh, ...obras]), config: cfg };
    },
  };
}
