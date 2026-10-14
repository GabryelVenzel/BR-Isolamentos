"use client";

import { useEffect, useMemo, useState } from "react";
import { aplicarMaoObraNosTrechos, calcularMaoObraDoWizard, horasMaoObraTotal, useWizardStore, type WizardItem } from "@/lib/store";
import { calcularOrcamento, catalogoItensExecucao, resolverItensExecucao, totalItensExecucao } from "@/lib/usecases/orcamento";
import type { CalcularOrcamentoResultado, ConfigEmpresa, ImpostoConfig, ItemExecucaoOrcamento, MaoObraEquipe } from "@/lib/types";
import type { PrecificacaoTrecho } from "@/lib/usecases/orcamento";

// Configuração da empresa + impostos extras: iguais em todas as etapas do
// orçamento — uma busca só por visita, compartilhada entre a barra de totais
// e as telas.
let cacheConfig: Promise<{ config: ConfigEmpresa; impostosExtras: ImpostoConfig[] }> | null = null;

function buscarConfig() {
  if (!cacheConfig) {
    cacheConfig = Promise.all([fetch("/api/config-empresa").then((r) => r.json()), fetch("/api/impostos-config").then((r) => r.json())])
      .then(([config, impostosExtras]) => {
        if (!config || config.error) throw new Error(config?.error ?? "Configuração da empresa não encontrada.");
        return { config: config as ConfigEmpresa, impostosExtras: (Array.isArray(impostosExtras) ? impostosExtras : []) as ImpostoConfig[] };
      })
      .catch((error) => {
        cacheConfig = null;
        throw error;
      });
  }
  return cacheConfig;
}

export interface OrcamentoCalculado {
  /** `null` enquanto carrega. */
  config: ConfigEmpresa | null;
  /** Trechos com a mão de obra da equipe já repartida (horas e valor). Com
   * `rascunho`, o trecho em edição vem por último. */
  trechos: Array<{ precificacao: PrecificacaoTrecho }>;
  maoObra: MaoObraEquipe | null;
  /** Catálogo de execução padrão cruzado com o que foi habilitado neste
   * orçamento (migração 051) — o total dos incluídos já está em
   * `resultado.valor_mao_obra` ("Execução"). */
  itensExecucao: ItemExecucaoOrcamento[];
  /** Orçamento completo (custos, impostos, margem, valor final); `null` sem
   * trechos, enquanto carrega ou quando o cálculo acusa erro. */
  resultado: CalcularOrcamentoResultado | null;
  erro: string | null;
}

/** O orçamento do wizard calculado NA HORA a partir do que está no estado:
 * trechos confirmados (+ o trecho em edição, se informado), equipe, diárias
 * e custos operacionais. Nada é gravado de volta — toda tela que mostra um
 * total usa este mesmo cálculo, então os números nunca divergem entre as
 * etapas nem ficam desatualizados quando algo muda. */
export function useOrcamentoCalculado(rascunho?: PrecificacaoTrecho | null): OrcamentoCalculado {
  const { itens, equipe, valoresDiariaOverride, horasUteisDiaOverride, diasMaoObraManual, custosOperacionais, margemPercentual, descontoValor, execucaoPadrao } =
    useWizardStore();
  const [dados, setDados] = useState<{ config: ConfigEmpresa; impostosExtras: ImpostoConfig[] } | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    buscarConfig()
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErroConfig(e instanceof Error ? e.message : "Não foi possível carregar a configuração."));
    return () => {
      ativo = false;
    };
  }, []);

  return useMemo(() => {
    if (!dados) return { config: null, trechos: [], maoObra: null, itensExecucao: [], resultado: null, erro: erroConfig };

    const todos: Array<{ precificacao: PrecificacaoTrecho }> = rascunho ? [...itens, { precificacao: rascunho }] : itens;
    const maoObra = calcularMaoObraDoWizard(todos, { equipe, valoresDiariaOverride, horasUteisDiaOverride, diasMaoObraManual }, dados.config);
    const trechos = aplicarMaoObraNosTrechos(todos, maoObra);
    const itensExecucao = resolverItensExecucao(catalogoItensExecucao(dados.config.itens_execucao_padrao), execucaoPadrao);
    if (trechos.length === 0) return { config: dados.config, trechos, maoObra, itensExecucao, resultado: null, erro: null };

    try {
      const soma = (campo: "subtotal_material" | "subtotal_mao_obra") => Number(trechos.reduce((acc, t) => acc + t.precificacao[campo], 0).toFixed(2));
      // Margem só deste orçamento, quando informada, no lugar da padrão.
      const config = margemPercentual != null ? { ...dados.config, margem_lucro_padrao: margemPercentual } : dados.config;
      const calcular = (descontoPercentual?: number) =>
        calcularOrcamento({
        valor_materiais_direto: soma("subtotal_material"),
        // Mão de obra da equipe (já repartida) + itens adicionais de execução
        // de cada trecho + itens de execução padrão habilitados no orçamento
        // — vai pronta; o motor não recalcula.
        valor_mao_obra_direto: Number((soma("subtotal_mao_obra") + totalItensExecucao(itensExecucao)).toFixed(2)),
        config,
        impostosExtras: dados.impostosExtras,
        horas_mao_obra: horasMaoObraTotal(trechos as WizardItem[]),
        km_deslocamento: custosOperacionais.km_deslocamento,
        noites_hospedagem: custosOperacionais.noites_hospedagem,
        valor_frete: custosOperacionais.valor_frete,
        diarias_aluguel_carro: custosOperacionais.diarias_aluguel_carro,
        quantidade_alimentacao: custosOperacionais.quantidade_alimentacao,
        desconto_percentual_extra: descontoPercentual,
      });
      // Desconto em R$: o motor trabalha com % do preço cheio — primeiro o
      // preço cheio (sem desconto), depois o percentual que dá esse valor. O
      // imposto incide sobre o valor final e a margem absorve o desconto
      // (ver lib/orcamento.ts).
      const semDesconto = calcular();
      const desconto = Math.min(Math.max(0, descontoValor || 0), semDesconto.preco_cheio);
      const resultado = desconto > 0 && semDesconto.preco_cheio > 0 ? calcular((desconto / semDesconto.preco_cheio) * 100) : semDesconto;
      return { config: dados.config, trechos, maoObra, itensExecucao, resultado, erro: null };
    } catch (error) {
      return { config: dados.config, trechos, maoObra, itensExecucao, resultado: null, erro: error instanceof Error ? error.message : "Erro ao calcular o orçamento." };
    }
  }, [dados, erroConfig, itens, rascunho, equipe, valoresDiariaOverride, horasUteisDiaOverride, diasMaoObraManual, custosOperacionais, margemPercentual, descontoValor, execucaoPadrao]);
}
