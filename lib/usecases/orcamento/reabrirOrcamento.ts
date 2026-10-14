// Reabrir um orçamento salvo no wizard (para editar "como se estivesse
// orçando do zero") — puro, sem I/O.
//
// Dois caminhos:
//
//   1. O orçamento tem a CÓPIA do wizard guardada ao salvar (migração 049):
//      volta exatamente como foi montado.
//   2. Não tem (orçamento anterior à migração 049): o wizard é RECONSTRUÍDO a
//      partir do que foi persistido em `orcamentos`/`itens_orcamento`. O que
//      dá para recuperar sem perda: escopo, material e acabamento, metragem,
//      temperaturas, espessura, quantidades e preços de cada material (viram
//      ajustes de lápis, para os números salvos não mudarem), itens
//      adicionais, resultado térmico, custos operacionais, margem e desconto.
//      O que NÃO foi persistido e precisa ser conferido — devolvido em
//      `avisos`: o combustível/custo de energia usado no cálculo de economia
//      e, nos orçamentos anteriores à migração 048, a equipe (a mão de obra
//      era em horas de uma dupla; ao reabrir ela é recalculada por equipe e
//      diárias, e o valor muda).

import type { ConfigEmpresa, FuncaoMaoObra, ItemEscopo, ItemOrcamento, Orcamento, PrecoConfig } from "../../types";
import type { AjustesTrecho, ChaveLinhaAjuste, ItemAdicional, WizardCustosOperacionais, WizardEspecificacoes, WizardItem } from "../../store";
import type { EscolhasExecucao } from "./itensExecucao";
import { EQUIPE_PADRAO, EQUIPE_VAZIA, funcaoProduz, rendimentoM2Dia, valorDiariaPadrao, type EquipeMaoObra } from "./maoObraEquipe";

/** O que o wizard guarda de um orçamento — a cópia salva junto dele e o que
 * `carregarEstado` (lib/store.ts) recebe de volta. */
export interface EstadoWizardSalvo {
  versao: 1;
  tipoProposta: "material_mo" | "somente_mo";
  itens: WizardItem[];
  custosOperacionais: WizardCustosOperacionais;
  horasUteisDiaOverride: number | null;
  equipe: EquipeMaoObra;
  valoresDiariaOverride: Partial<Record<FuncaoMaoObra, number | null>>;
  diasMaoObraManual: number | null;
  /** Itens de execução padrão habilitados (migração 051); ausente em cópias
   * guardadas antes dela. */
  execucaoPadrao?: EscolhasExecucao;
  /** Margem de lucro só deste orçamento (%); `null` = a de Configurar Preços. */
  margemPercentual: number | null;
  /** Desconto em R$ sobre o preço cheio. */
  descontoValor: number;
  observacoes: string;
}

const round2 = (n: number) => Number(n.toFixed(2));
const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

const CHAVES_PADRAO: ChaveLinhaAjuste[] = ["isolante", "acabamento", "rebite", "parafuso", "arame", "silicone"];

function reconstruirTrecho(item: ItemOrcamento, tipoProposta: EstadoWizardSalvo["tipoProposta"], precos: PrecoConfig[]): WizardItem {
  const quente = item.tipo_trabalho !== "frio";
  const detalhamento = item.detalhamento_materiais ?? [];

  const escopoItens: ItemEscopo[] =
    (item.escopo_itens?.length ?? 0) > 0
      ? item.escopo_itens
      : [{ id: `trecho-${item.id}`, nome: "Trecho", tipo: "plano", diametro_mm: null, comprimento_m: null, quantidade: null, metragem_manual_m2: item.area_m2, metragem_editada: false }];

  // Material/acabamento: se o nome salvo ainda existe no catálogo, volta
  // ligado a ele; senão volta como "outro material" com o preço salvo.
  const noCatalogo = (nome: string | null | undefined, prefixo: string) =>
    nome ? precos.find((p) => p.ativo && String(p.tipo_material).startsWith(prefixo) && (p.descricao === nome || (p as { familia?: string | null }).familia === nome)) : undefined;
  const isolante = noCatalogo(item.material, "isolante");
  const acabamento = noCatalogo(item.acabamento, "chaparia");

  const especificacoes: WizardEspecificacoes = {
    tipo_trabalho: quente ? "quente" : "frio",
    preco_isolante_id: isolante?.id ?? null,
    preco_acabamento_id: acabamento?.id ?? null,
    isolante_customizado_nome: isolante ? null : item.material,
    isolante_customizado_preco_m2: isolante ? null : numero(item.preco_isolante_m2),
    acabamento_customizado_nome: acabamento ? null : item.acabamento ?? "Sem acabamento",
    acabamento_customizado_preco_m2: acabamento ? null : numero(item.preco_acabamento_m2),
    trabalho_altura: !!item.trabalho_altura,
    remocao_isolamento: !!item.remocao_isolamento,
    espessura_mm: numero(item.espessura_necessaria_mm) || null,
    temperatura_quente: item.temperatura_quente,
    temperatura_ambiente: item.temperatura_ambiente,
    umidade_relativa: item.umidade_relativa ?? 70,
    velocidade_vento_ms: item.velocidade_vento ?? 0,
    calcular_financeiro: true,
    combustivel: "eletricidade",
    custo_combustivel: null,
    horas_operacao_dia: 8,
    dias_operacao_semana: 5,
    metragem_editada: false,
    metragem_manual_m2: null,
  };

  // Ajustes: itens adicionais voltam como estavam; cada material padrão volta
  // com quantidade/preço/unidade salvos (lápis), e o que não está no
  // detalhamento volta como linha excluída.
  const itensAdicionais: ItemAdicional[] = detalhamento
    .filter((l) => l.chave === "item_adicional_material" || l.chave === "item_adicional_execucao")
    .map((l, i) => ({
      id: item.id * 1000 + i,
      nome: l.titulo,
      quantidade: l.quantidade,
      precoUnitario: l.preco_unitario,
      unidade: l.unidade,
      categoria: l.chave === "item_adicional_material" ? ("material" as const) : ("execucao" as const),
    }));
  const overrides: AjustesTrecho["overrides"] = {};
  if (tipoProposta !== "somente_mo" && detalhamento.length > 0) {
    for (const chave of CHAVES_PADRAO) {
      const linhas = detalhamento.filter((l) => l.chave === chave);
      if (linhas.length === 1) overrides[chave] = { quantidade: linhas[0].quantidade, precoUnitario: linhas[0].preco_unitario, unidade: linhas[0].unidade };
      else if (linhas.length === 0) overrides[chave] = { quantidade: 0, removida: true };
      // Mais de uma linha = isolante composto em camadas: recalculado pelo catálogo.
    }
  }

  const eficiencia = numero(item.eficiencia_global) > 0 ? numero(item.eficiencia_global) : 1;
  const subtotalExecucao = round2(itensAdicionais.filter((i) => i.categoria === "execucao").reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0));
  const semMaoObra = numero(item.horas_mao_obra) <= 0 && numero(item.subtotal_mao_obra) <= subtotalExecucao;
  if (semMaoObra) overrides.maoObra = { removida: true };

  return {
    escopoItens,
    especificacoes,
    materialNome: item.material,
    acabamentoNome: item.acabamento ?? null,
    especificacaoIsolante: item.especificacao_isolante ?? null,
    especificacaoAcabamento: item.especificacao_acabamento ?? null,
    resultadoTermicoQuente: quente
      ? {
          temperatura_face_fria: numero(item.temperatura_face_fria),
          temperaturas_interfaces: [],
          perda_com_isolante_kw_m2: numero(item.perda_com_isolante),
          perda_sem_isolante_kw_m2: numero(item.perda_sem_isolante),
          convergiu: true,
          financeiro:
            item.economia_anual != null
              ? {
                  economia_anual: item.economia_anual,
                  economia_mensal: round2(item.economia_anual / 12),
                  reducao_percentual:
                    numero(item.perda_sem_isolante) > 0 ? round2((1 - numero(item.perda_com_isolante) / numero(item.perda_sem_isolante)) * 100) : 0,
                  co2_ton_ano: numero(item.co2_ton_ano),
                }
              : undefined,
        }
      : null,
    resultadoTermicoFrio: quente ? null : { temperatura_orvalho: 0, espessura_minima_mm: numero(item.espessura_necessaria_mm) || null, convergiu: true },
    precificacao: {
      metragem_m2: item.area_m2,
      preco_isolante_m2: numero(item.preco_isolante_m2),
      preco_acabamento_m2: numero(item.preco_acabamento_m2),
      horas_mao_obra: numero(item.horas_mao_obra),
      m2_equivalente_mao_obra: semMaoObra ? 0 : round2(item.area_m2 / eficiencia),
      subtotal_itens_execucao: subtotalExecucao,
      eficiencia_global: eficiencia,
      subtotal_material: numero(item.subtotal_material),
      subtotal_mao_obra: numero(item.subtotal_mao_obra),
      subtotal_trecho: round2(numero(item.subtotal_material) + numero(item.subtotal_mao_obra)),
      quantidades: { isolanteM2: 0, acabamentoM2: 0, rebiteUn: 0, parafusoUn: 0, arameMetros: 0, siliconeFrascos: 0 },
      detalhamentoMateriais: detalhamento,
    },
    valorMateriais: numero(item.subtotal_material),
    ajustes: { overrides, itensAdicionais },
  };
}

/** Reconstrói o estado do wizard de um orçamento que não tem a cópia salva.
 * `avisos` lista, em linguagem de usuário, o que não pôde ser recuperado. */
export function reconstruirEstadoWizard(orcamento: Orcamento, config: ConfigEmpresa, precos: PrecoConfig[]): { estado: EstadoWizardSalvo; avisos: string[] } {
  const avisos: string[] = [];
  const tipoProposta = orcamento.tipo_proposta ?? "material_mo";
  const itens = [...(orcamento.itens ?? [])].sort((a, b) => a.ordem - b.ordem).map((item) => reconstruirTrecho(item, tipoProposta, precos));

  // Equipe e diárias.
  let equipe: EquipeMaoObra = { ...EQUIPE_PADRAO };
  const valoresDiariaOverride: EstadoWizardSalvo["valoresDiariaOverride"] = {};
  let diasMaoObraManual: number | null = null;
  let horasUteisDiaOverride: number | null = null;
  const salva = orcamento.mao_obra_equipe;
  if (salva) {
    equipe = { ...EQUIPE_VAZIA };
    for (const f of salva.funcoes) {
      equipe[f.funcao] = f.pessoas;
      if (Math.abs(f.valor_diaria - valorDiariaPadrao(f.funcao, config)) > 0.004) valoresDiariaOverride[f.funcao] = f.valor_diaria;
    }
    diasMaoObraManual = salva.dias_manual ? salva.dias : null;
    horasUteisDiaOverride = orcamento.horas_uteis_dia ?? null;
    const mudou = salva.funcoes.some((f) => funcaoProduz(f.funcao) && Math.abs(f.m2_dia - rendimentoM2Dia(f.funcao, config)) > 0.004);
    if (mudou && !salva.dias_manual) {
      avisos.push("O rendimento das funções em Configurar Preços mudou desde que este orçamento foi criado — os dias de obra e a mão de obra são recalculados com os valores atuais.");
    }
  } else {
    // Orçamento anterior à migração 048: a mão de obra era em horas de uma
    // dupla × valor/hora (muitas vezes ajustada à mão). Para o valor salvo
    // NÃO mudar só por reabrir, ela é convertida na dupla equivalente — 1
    // funileiro + 1 isolador, pelos dias que as horas salvas davam, com a
    // diária ajustada para fechar no mesmo total (pode diferir em centavos,
    // pelo arredondamento da diária).
    const execucao =
      itens.reduce((acc, i) => acc + i.precificacao.subtotal_itens_execucao, 0) +
      (orcamento.itens_execucao ?? []).reduce((acc, i) => acc + (i.incluido ? numero(i.subtotal) : 0), 0);
    const maoObraSalva = round2(Math.max(0, numero(orcamento.valor_mao_obra) - execucao));
    const horas = (orcamento.itens ?? []).reduce((acc, i) => acc + numero(i.horas_mao_obra), 0);
    const horasDia = numero(orcamento.horas_uteis_dia) > 0 ? numero(orcamento.horas_uteis_dia) : numero(config.horas_uteis_dia) || 7;
    if (maoObraSalva > 0) {
      const dias = Math.max(1, Math.ceil(Number((horas / horasDia).toFixed(6))));
      const diaria = round2(maoObraSalva / (2 * dias));
      equipe = { ...EQUIPE_VAZIA, funileiro: 1, isolador: 1 };
      valoresDiariaOverride.funileiro = diaria;
      valoresDiariaOverride.isolador = diaria;
      diasMaoObraManual = dias;
      avisos.push(
        `Este orçamento é anterior ao formato de equipe e diárias. Para manter o valor de mão de obra que estava salvo (${formatar(maoObraSalva)}), ele foi convertido em 1 funileiro + 1 isolador por ${dias} ${dias === 1 ? "dia" : "dias"}, com a diária ajustada para ${formatar(diaria)}. Para recalcular pela equipe real, vá em "Equipe e custos", informe as pessoas e apague as diárias ajustadas e os dias manuais.`
      );
    } else {
      equipe = { ...EQUIPE_VAZIA };
      avisos.push("Este orçamento é anterior ao formato de equipe e diárias e estava sem mão de obra — a equipe volta zerada. Informe as pessoas em \"Equipe e custos\" se quiser incluir.");
    }
  }

  // Custos operacionais: só os valores foram salvos; volta para quantidade
  // pelo preço unitário atual.
  const quantidade = (valor: number, unitario: number) => (unitario > 0 ? round2(numero(valor) / unitario) : 0);
  const custosOperacionais: WizardCustosOperacionais = {
    km_deslocamento: quantidade(orcamento.valor_deslocamento, config.valor_km_deslocamento),
    noites_hospedagem: quantidade(orcamento.valor_hospedagem, config.valor_noite_hospedagem),
    valor_frete: numero(orcamento.valor_frete),
    diarias_aluguel_carro: quantidade(orcamento.valor_aluguel_carro, config.valor_diaria_aluguel_carro),
    quantidade_alimentacao: quantidade(orcamento.valor_alimentacao, config.valor_diaria_alimentacao),
    desconto_percentual_extra: null,
  };
  const semPreco =
    (numero(orcamento.valor_deslocamento) > 0 && !(config.valor_km_deslocamento > 0)) ||
    (numero(orcamento.valor_hospedagem) > 0 && !(config.valor_noite_hospedagem > 0)) ||
    (numero(orcamento.valor_aluguel_carro) > 0 && !(config.valor_diaria_aluguel_carro > 0)) ||
    (numero(orcamento.valor_alimentacao) > 0 && !(config.valor_diaria_alimentacao > 0));
  if (semPreco) avisos.push("Algum custo operacional deste orçamento não tem mais preço unitário em Configurar Preços — confira as quantidades na etapa \"Equipe e custos\".");

  // Itens de execução padrão: os que estavam incluídos voltam habilitados,
  // com a quantidade e o preço que tinham.
  const execucaoPadrao: EscolhasExecucao = {};
  for (const item of orcamento.itens_execucao ?? []) {
    if (item.incluido) execucaoPadrao[item.id] = { incluido: true, quantidade: item.quantidade, precoUnitario: item.preco_unitario };
  }

  // Margem: a que foi usada = 100 × (1 − custo ÷ preço cheio) − impostos.
  let margemPercentual: number | null = null;
  if (numero(orcamento.preco_cheio) > 0 && numero(orcamento.subtotal) > 0) {
    const impostos = (orcamento.detalhamento_impostos ?? []).reduce((acc, i) => acc + numero(i.percentual), 0);
    // 4 casas: em orçamento grande, arredondar a margem para 2 casas já
    // desloca o valor final em vários reais.
    const usada = Number((100 * (1 - orcamento.subtotal / orcamento.preco_cheio) - impostos).toFixed(4));
    if (usada >= 0 && usada < 100 && Math.abs(usada - config.margem_lucro_padrao) > 0.05) margemPercentual = usada;
  }

  if (itens.some((i) => i.especificacoes.tipo_trabalho === "quente" && i.resultadoTermicoQuente?.financeiro)) {
    avisos.push("O custo de energia usado no cálculo de economia não ficou guardado: os valores de economia e CO₂ continuam como estavam, mas se você abrir as Especificações de um trecho quente terá que informar o custo do combustível de novo.");
  }

  return {
    estado: {
      versao: 1,
      tipoProposta,
      itens,
      custosOperacionais,
      horasUteisDiaOverride,
      equipe,
      valoresDiariaOverride,
      diasMaoObraManual,
      execucaoPadrao,
      margemPercentual,
      descontoValor: numero(orcamento.valor_desconto),
      observacoes: orcamento.observacoes_adicionais ?? "",
    },
    avisos,
  };
}

function formatar(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numero(valor));
}

/** A cópia guardada serve? (formato conhecido e com trechos). */
export function estadoWizardValido(estado: unknown): estado is EstadoWizardSalvo {
  const e = estado as Partial<EstadoWizardSalvo> | null;
  return !!e && e.versao === 1 && Array.isArray(e.itens) && e.itens.length > 0 && !!e.equipe && !!e.custosOperacionais;
}
