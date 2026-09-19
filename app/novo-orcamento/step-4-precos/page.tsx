"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { horasMaoObraTotal, useWizardStore } from "@/lib/store";
import { comporCamadasIsolante, precificarTrecho, precoAcessorioPorUnidade, somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { CalcularOrcamentoInput, ConfigEmpresa, ImpostoConfig, PrecoConfig } from "@/lib/types";

/** Preço de um acessório por unidade de quantidade — Rebite/Parafuso vêm do
 * catálogo "por centena" e são convertidos (ver precoAcessorio.ts). */
const precoAcessorio = precoAcessorioPorUnidade;

type ChaveLinha = "isolante" | "acabamento" | "rebite" | "parafuso" | "arame" | "silicone" | "maoObra";

interface OverrideLinha {
  quantidade?: number;
  precoUnitario?: number;
  /** Unidade de medida exibida (migração — pedido "devo poder editar a
   * quantidade, o preço e a unidade de medida") — cosmética: não recalcula
   * nada, só reflete melhor o que a quantidade representa quando o valor
   * automático é ajustado (ex.: trocar "m" por "verba" no Arame). */
  unidade?: string;
  /** Linha excluída deste trecho (pedido explícito: "devo conseguir excluir
   * os itens... não somente editá-los") — zera a quantidade (some do
   * subtotal e do detalhamento persistido, que já filtra `quantidade > 0`)
   * e marca pra sumir da tabela; "Restaurar" limpa o override inteiro,
   * voltando ao valor calculado automaticamente. */
  removida?: boolean;
}

interface LinhaEdicao {
  chave: ChaveLinha;
  titulo: string;
  unidadeQuantidade: string;
  unidadePreco: string;
  quantidadeBase: number;
  precoBase: number;
}

/** Item livre da caixa "Itens Adicionais" (migração 025/026) — pra casos
 * fora do catálogo/quantificação automática (andaime, linha de vida, etc.):
 * nome, quantidade e preço unitário digitados direto, sem passar pelo motor
 * de quantificação. `categoria` decide em qual subtotal do trecho o item
 * entra — "material" soma no Subtotal de Materiais, "execucao" soma junto
 * com a mão de obra (pedido explícito: andaime não é material, é custo de
 * execução do serviço) — os dois já entram no valor do trecho pra
 * imposto/margem incidirem em cima, e viram mais uma linha em
 * `detalhamento_materiais` pra aparecer no quadro de materiais e mão de obra
 * da Proposta. */
interface ItemAdicional {
  id: number;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  unidade: string;
  categoria: "material" | "execucao";
}

/** Tela 4 (refinada, ajuste final) — Resumo técnico virou só a análise
 * térmica (material/acabamento já aparecem na Quantificação, não precisa
 * repetir); as duas caixas grandes de "Preços deste trecho" viraram um
 * sistema uniforme de edição por lápis (mesma mecânica pra isolante,
 * acabamento, os 4 acessórios E mão de obra); "+ Adicionar outro trecho"
 * saiu daqui — essa ação já existe na Revisão (Tela 5), não precisa duplicar. */
export default function Step4PrecosPage() {
  const router = useRouter();
  const {
    itemAtual: especificacoes,
    escopoAtual,
    resultadoTermicoQuenteAtual,
    resultadoTermicoFrioAtual,
    itens,
    tipoProposta,
    custosOperacionais,
    setCustosOperacionais,
    horasUteisDiaOverride,
    setHorasUteisDiaOverride,
    confirmarItemAtual,
    setResultadoOrcamento,
  } = useWizardStore();

  const [precos, setPrecos] = useState<PrecoConfig[]>([]);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [impostosExtras, setImpostosExtras] = useState<ImpostoConfig[]>([]);
  const [overrides, setOverrides] = useState<Partial<Record<ChaveLinha, OverrideLinha>>>({});
  const [editando, setEditando] = useState<LinhaEdicao | null>(null);
  const [salvando, setSalvando] = useState<"revisao" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [itensAdicionais, setItensAdicionais] = useState<ItemAdicional[]>([]);
  const [novoItemAdicional, setNovoItemAdicional] = useState<{
    nome: string;
    quantidade: string;
    precoUnitario: string;
    unidade: string;
    categoria: "material" | "execucao";
  }>({ nome: "", quantidade: "1", precoUnitario: "", unidade: "un.", categoria: "material" });

  useEffect(() => {
    Promise.all([
      fetch("/api/precos-config").then((r) => r.json()),
      fetch("/api/config-empresa").then((r) => r.json()),
      fetch("/api/impostos-config").then((r) => r.json()),
    ]).then(([p, c, i]) => {
      setPrecos(p);
      setConfig(c);
      setImpostosExtras(i);
    });
  }, []);

  const isolanteCustomizado = especificacoes.isolante_customizado_nome != null;
  const acabamentoCustomizado = especificacoes.acabamento_customizado_nome != null;

  const precoIsolanteCatalogo = precos.find((p) => p.id === especificacoes.preco_isolante_id);
  const precoAcabamentoCatalogo = precos.find((p) => p.id === especificacoes.preco_acabamento_id);

  // Nome exibido em "Especificações Técnicas"/resumo — nome da FAMÍLIA (sem
  // espessura, ex. "Feltro de Lã de Rocha 64kg/m³"), não da linha específica
  // selecionada no catálogo (migração 025): a espessura real do trecho pode
  // ser composta de várias linhas/camadas da família (ver camadasIsolante
  // abaixo), então mostrar a espessura de só uma delas seria enganoso.
  const nomeIsolante = isolanteCustomizado
    ? especificacoes.isolante_customizado_nome!
    : precoIsolanteCatalogo?.familia ?? precoIsolanteCatalogo?.descricao ?? "Isolante";
  const nomeAcabamento = acabamentoCustomizado ? especificacoes.acabamento_customizado_nome! : precoAcabamentoCatalogo?.descricao ?? "Acabamento";

  // Só bloqueia avançar por falta de resultado térmico quando NÃO é material
  // customizado (esses trechos pulam o cálculo térmico de propósito — ver
  // step-3-especificacoes/page.tsx).
  const materialCustomizado = isolanteCustomizado || acabamentoCustomizado;
  const temResultado = materialCustomizado || !!(resultadoTermicoQuenteAtual || resultadoTermicoFrioAtual);
  const metragem = especificacoes.metragem_editada ? especificacoes.metragem_manual_m2 ?? 0 : somarMetragemEscopo(escopoAtual);

  const precoIsolanteBase = isolanteCustomizado ? especificacoes.isolante_customizado_preco_m2 ?? 0 : precoIsolanteCatalogo?.preco_unitario ?? 0;
  const precoAcabamentoBase = acabamentoCustomizado ? especificacoes.acabamento_customizado_preco_m2 ?? 0 : precoAcabamentoCatalogo?.preco_unitario ?? 0;

  const precosAcessorios = {
    rebiteUn: precoAcessorio(precos, "acessorio_rebite"),
    parafusoUn: precoAcessorio(precos, "acessorio_parafuso"),
    arameMetro: precoAcessorio(precos, "acessorio_arame"),
    siliconeFrasco: precoAcessorio(precos, "acessorio_silicone"),
  };

  // Espessura do trecho — do cálculo térmico (quente) ou da espessura
  // mínima calculada (frio); 0 em material customizado, que pula o cálculo
  // térmico (ver step-3-especificacoes). Só usada pra achar o diâmetro já
  // isolado na quantificação de isolante/chaparia (migração 023) — mesma
  // lógica já usada em step-5-revisao pra `espessura_necessaria_mm`.
  const espessuraMm =
    especificacoes.tipo_trabalho === "quente"
      ? especificacoes.espessura_mm ?? 0
      : resultadoTermicoFrioAtual?.espessura_minima_mm ?? 0;

  // Baseline: quantificação automática + mão de obra automática (motor da
  // migração 019), ainda SEM os overrides manuais desta tela.
  const base =
    config && temResultado
      ? precificarTrecho({
          escopoItens: escopoAtual,
          espessuraMm,
          tipoProposta,
          precoIsolanteM2: precoIsolanteBase,
          precoAcabamentoM2: precoAcabamentoBase,
          precosAcessorios,
          valorHoraMaoObra: config.valor_hora_mao_obra,
          trabalhoAltura: especificacoes.trabalho_altura,
          parametrosQuantificacao: config,
          parametrosMaoObra: config,
        })
      : null;

  function valor(chave: ChaveLinha, campo: "quantidade" | "precoUnitario", base: number): number {
    return overrides[chave]?.[campo] ?? base;
  }

  function unidadeAtual(chave: ChaveLinha, base: string): string {
    return overrides[chave]?.unidade ?? base;
  }

  function estaRemovida(chave: ChaveLinha): boolean {
    return overrides[chave]?.removida === true;
  }

  function excluirLinha(chave: ChaveLinha) {
    // Zera a quantidade (some dos subtotais/detalhamento, que já filtram
    // `quantidade > 0`) e marca como removida só pra decidir o que mostrar
    // na tabela — ver comentário em `OverrideLinha.removida`.
    setOverrides((prev) => ({ ...prev, [chave]: { ...prev[chave], quantidade: 0, removida: true } }));
  }

  function restaurarLinha(chave: ChaveLinha) {
    setOverrides((prev) => {
      const { [chave]: _removida, ...resto } = prev;
      return resto;
    });
  }

  // Composição em camadas do isolante (migração 025) — o catálogo agora só
  // tem espessuras PADRÃO por família (ex.: Feltro de Lã de Rocha só em 25mm
  // e 51mm); quando a espessura exigida do trecho não é uma delas, decompõe
  // em 2+ camadas (ex.: 75mm = 50mm + 25mm), cada uma com preço da sua
  // própria linha do catálogo. Só roda com material de catálogo (não
  // customizado) e quando a família tem espessuras cadastradas — caso
  // contrário cai no comportamento antigo (1 linha só, editável no lápis).
  const familiaIsolanteRows =
    !isolanteCustomizado && precoIsolanteCatalogo?.familia
      ? precos.filter((p) => p.familia === precoIsolanteCatalogo.familia && p.ativo)
      : [];
  const camadasIsolante =
    familiaIsolanteRows.length > 0
      ? comporCamadasIsolante(
          espessuraMm,
          familiaIsolanteRows.map((p) => p.espessura_mm ?? 0)
        )
      : [];
  const usaComposicaoIsolante = camadasIsolante.length > 0;

  // Linhas de isolante já compostas — não passam pelo sistema de lápis
  // (decisão de escopo: são um resultado determinístico do catálogo × área,
  // diferente das quantidades estimadas pelo motor automático; pra um ajuste
  // pontual, use a caixa "Itens Adicionais" ou corrija o preço da linha
  // específica em Configurar Preços). Cada camada cobre a metragem TOTAL do
  // trecho (pedido explícito do usuário), multiplicada por quantas camadas
  // dessa espessura entram na composição.
  const linhasIsolanteComposto = usaComposicaoIsolante
    ? camadasIsolante.map((camada) => {
        const row = familiaIsolanteRows.find((p) => p.espessura_mm === camada.espessuraMm);
        const quantidade = (base?.quantidades.isolanteM2 ?? 0) * camada.quantidadeCamadas;
        const precoUnitario = row?.preco_unitario ?? 0;
        return {
          titulo:
            camada.quantidadeCamadas > 1
              ? `${row?.descricao ?? "Isolante"} (${camada.quantidadeCamadas} camadas)`
              : row?.descricao ?? "Isolante",
          quantidade,
          precoUnitario,
          subtotal: Number((quantidade * precoUnitario).toFixed(2)),
        };
      })
    : [];
  const subtotalIsolanteComposto = Number(linhasIsolanteComposto.reduce((acc, l) => acc + l.subtotal, 0).toFixed(2));

  const linhas: LinhaEdicao[] = base
    ? [
        // Isolante entra aqui (editável no lápis, 1 linha só) SÓ quando a
        // composição em camadas não roda (customizado ou família sem
        // espessuras cadastradas) — o caso composto renderiza separado
        // (`linhasIsolanteComposto`), sem lápis.
        ...(usaComposicaoIsolante
          ? []
          : [{ chave: "isolante" as const, titulo: nomeIsolante, unidadeQuantidade: "m²", unidadePreco: "m²", quantidadeBase: base.quantidades.isolanteM2, precoBase: precoIsolanteBase }]),
        { chave: "acabamento", titulo: nomeAcabamento, unidadeQuantidade: "m²", unidadePreco: "m²", quantidadeBase: base.quantidades.acabamentoM2, precoBase: precoAcabamentoBase },
        { chave: "rebite", titulo: "Rebite", unidadeQuantidade: "un.", unidadePreco: "un.", quantidadeBase: base.quantidades.rebiteUn, precoBase: precosAcessorios.rebiteUn },
        { chave: "parafuso", titulo: "Parafuso", unidadeQuantidade: "un.", unidadePreco: "un.", quantidadeBase: base.quantidades.parafusoUn, precoBase: precosAcessorios.parafusoUn },
        { chave: "arame", titulo: "Arame", unidadeQuantidade: "m", unidadePreco: "m", quantidadeBase: base.quantidades.arameMetros, precoBase: precosAcessorios.arameMetro },
        { chave: "silicone", titulo: "Silicone", unidadeQuantidade: "frasco(s)", unidadePreco: "frasco", quantidadeBase: base.quantidades.siliconeFrascos, precoBase: precosAcessorios.siliconeFrasco },
      ]
    : [];

  // Itens adicionais entram no subtotal do trecho independente do tipo de
  // proposta — andaime/linha de vida são custos reais mesmo numa proposta
  // "Somente Mão de Obra" (o cliente não fornece esse tipo de item). Cada
  // item soma no bucket da sua `categoria`: "material" some com o catálogo
  // (Subtotal de Materiais); "execucao" some com a mão de obra (pedido
  // explícito — andaime não é material, é custo de execução do serviço).
  const subtotalItensAdicionaisMaterial = Number(
    itensAdicionais
      .filter((it) => it.categoria === "material")
      .reduce((acc, it) => acc + it.quantidade * it.precoUnitario, 0)
      .toFixed(2)
  );
  const subtotalItensAdicionaisExecucao = Number(
    itensAdicionais
      .filter((it) => it.categoria === "execucao")
      .reduce((acc, it) => acc + it.quantidade * it.precoUnitario, 0)
      .toFixed(2)
  );
  const subtotalItensAdicionais = Number((subtotalItensAdicionaisMaterial + subtotalItensAdicionaisExecucao).toFixed(2));

  const subtotalMaterialCatalogo =
    !base || tipoProposta === "somente_mo"
      ? 0
      : Number(
          (
            linhas.reduce((acc, l) => acc + valor(l.chave, "quantidade", l.quantidadeBase) * valor(l.chave, "precoUnitario", l.precoBase), 0) +
            subtotalIsolanteComposto
          ).toFixed(2)
        );

  // Subtotal de material "oficial" do trecho (persistido/usado no cálculo de
  // imposto e margem) = catálogo + itens adicionais de categoria "material".
  const subtotalMaterial = !base ? 0 : Number((subtotalMaterialCatalogo + subtotalItensAdicionaisMaterial).toFixed(2));

  function adicionarItemAdicional() {
    const nome = novoItemAdicional.nome.trim();
    const quantidade = Number(novoItemAdicional.quantidade);
    const precoUnitario = Number(novoItemAdicional.precoUnitario);
    if (!nome || !(quantidade > 0) || !(precoUnitario >= 0)) return;

    setItensAdicionais((prev) => [
      ...prev,
      { id: Date.now(), nome, quantidade, precoUnitario, unidade: novoItemAdicional.unidade.trim() || "un.", categoria: novoItemAdicional.categoria },
    ]);
    setNovoItemAdicional({ nome: "", quantidade: "1", precoUnitario: "", unidade: "un.", categoria: "material" });
  }

  function removerItemAdicional(id: number) {
    setItensAdicionais((prev) => prev.filter((it) => it.id !== id));
  }

  const horasMaoObraEfetiva = base ? valor("maoObra", "quantidade", base.horas_mao_obra) : 0;
  const valorHoraEfetivo = base ? valor("maoObra", "precoUnitario", base.valor_hora_mao_obra) : 0;
  // Subtotal "oficial" de execução do trecho (persistido em subtotal_mao_obra)
  // = mão de obra automática (horas × valor/hora) + itens adicionais de
  // categoria "execucao" (ex.: andaime, linha de vida). O card "Mão de obra"
  // abaixo mostra só a parte de horas — os itens de execução aparecem no
  // próprio card "Itens Adicionais".
  const subtotalMaoObraHoras = Number((horasMaoObraEfetiva * valorHoraEfetivo).toFixed(2));
  const subtotalMaoObra = Number((subtotalMaoObraHoras + subtotalItensAdicionaisExecucao).toFixed(2));
  const subtotalTrecho = Number((subtotalMaterial + subtotalMaoObra).toFixed(2));

  // Título real de cada linha (material/acabamento escolhido) — precificarTrecho()
  // só conhece preços, não os nomes; sobrescrevemos aqui antes de persistir
  // (migração 020) para a Proposta Comercial exibir "Fibra Cerâmica 96kg/m³",
  // não um genérico "Isolante".
  const TITULOS: Partial<Record<ChaveLinha, string>> = { isolante: nomeIsolante, acabamento: nomeAcabamento };

  function montarPayloadConfirmacao() {
    if (!base) return null;

    // Reconstrói o detalhamento com o título real + quantidade/preço já com
    // overrides aplicados (mesmas linhas exibidas na tabela acima) — é isso
    // que fica persistido em `itens_orcamento.detalhamento_materiais` para a
    // Proposta Comercial poder reconstruir a tabela depois de salvo.
    const detalhamentoLinhasPadrao =
      tipoProposta === "somente_mo"
        ? []
        : linhas
            .map((l) => {
              const quantidade = valor(l.chave, "quantidade", l.quantidadeBase);
              const precoUnitario = valor(l.chave, "precoUnitario", l.precoBase);
              return {
                chave: l.chave as "isolante" | "acabamento" | "rebite" | "parafuso" | "arame" | "silicone",
                titulo: TITULOS[l.chave] ?? l.titulo,
                quantidade,
                unidade: unidadeAtual(l.chave, l.unidadeQuantidade),
                preco_unitario: precoUnitario,
                subtotal: Number((quantidade * precoUnitario).toFixed(2)),
              };
            })
            .filter((l) => l.quantidade > 0);

    // Camadas de isolante compostas (migração 025) — mesma chave "isolante"
    // das linhas padrão (o `chave` é só um marcador de categoria, não uma
    // chave única — várias linhas podem compartilhá-la, igual já acontece
    // com "item_adicional_material"/"item_adicional_execucao").
    const detalhamentoIsolanteComposto =
      tipoProposta === "somente_mo"
        ? []
        : linhasIsolanteComposto
            .filter((l) => l.quantidade > 0)
            .map((l) => ({
              chave: "isolante" as const,
              titulo: l.titulo,
              quantidade: l.quantidade,
              unidade: "m²",
              preco_unitario: l.precoUnitario,
              subtotal: l.subtotal,
            }));

    const detalhamentoCatalogo = [...detalhamentoLinhasPadrao, ...detalhamentoIsolanteComposto];

    // Itens adicionais (migração 025/026) — sempre entram, mesmo em
    // "somente_mo" (ver comentário em subtotalItensAdicionais acima). A
    // chave já carrega a categoria (material/execução) escolhida pelo
    // usuário, pra manter rastreável no histórico persistido qual subtotal
    // cada item alimentou.
    const detalhamentoAdicionais = itensAdicionais.map((it) => ({
      chave: it.categoria === "material" ? ("item_adicional_material" as const) : ("item_adicional_execucao" as const),
      titulo: it.nome,
      quantidade: it.quantidade,
      unidade: it.unidade,
      preco_unitario: it.precoUnitario,
      subtotal: Number((it.quantidade * it.precoUnitario).toFixed(2)),
    }));

    const detalhamentoFinal = [...detalhamentoCatalogo, ...detalhamentoAdicionais];

    // `preco_isolante_m2` (campo legado, exibido só na página interna de
    // detalhe do orçamento — não na Proposta) vira o preço EFETIVO por m²
    // somando o preço de todas as camadas compostas, já que o custo real do
    // isolante deste trecho não é mais "1 preço só" quando há composição.
    const precoIsolanteEfetivo = usaComposicaoIsolante
      ? Number((subtotalIsolanteComposto / (base.quantidades.isolanteM2 || 1)).toFixed(4))
      : valor("isolante", "precoUnitario", precoIsolanteBase);

    return {
      materialNome: nomeIsolante,
      acabamentoNome: nomeAcabamento,
      especificacaoIsolante: isolanteCustomizado ? null : precoIsolanteCatalogo?.especificacao ?? null,
      especificacaoAcabamento: acabamentoCustomizado ? null : precoAcabamentoCatalogo?.especificacao ?? null,
      precificacao: {
        ...base,
        preco_isolante_m2: precoIsolanteEfetivo,
        preco_acabamento_m2: valor("acabamento", "precoUnitario", precoAcabamentoBase),
        horas_mao_obra: horasMaoObraEfetiva,
        valor_hora_mao_obra: valorHoraEfetivo,
        subtotal_material: subtotalMaterial,
        subtotal_mao_obra: subtotalMaoObra,
        subtotal_trecho: subtotalTrecho,
        detalhamentoMateriais: detalhamentoFinal,
      },
    };
  }

  async function irParaRevisao() {
    const payload = montarPayloadConfirmacao();
    if (!payload || !config) return;

    setErro(null);
    setSalvando("revisao");
    try {
      confirmarItemAtual(payload);
      const todosOsItens = useWizardStore.getState().itens;

      const valorMateriaisTotal = Number(
        todosOsItens.reduce((acc, i) => acc + i.precificacao.subtotal_material, 0).toFixed(2)
      );
      // Bug relatado: um Item Adicional de execução (ex.: "Remoção de
      // isolamento") somava certo no subtotal do trecho, mas sumia do Resumo
      // Financeiro final — sem `valor_mao_obra_direto`, calcularOrcamento()
      // recomputava a mão de obra do zero só como horas × valor/hora,
      // ignorando qualquer item adicional (que não é cobrado por hora).
      const valorMaoObraTotal = Number(
        todosOsItens.reduce((acc, i) => acc + i.precificacao.subtotal_mao_obra, 0).toFixed(2)
      );

      const calcInput: CalcularOrcamentoInput = {
        valor_materiais_direto: valorMateriaisTotal,
        valor_mao_obra_direto: valorMaoObraTotal,
        config,
        impostosExtras,
        horas_mao_obra: horasMaoObraTotal(todosOsItens),
        km_deslocamento: custosOperacionais.km_deslocamento,
        noites_hospedagem: custosOperacionais.noites_hospedagem,
        valor_frete: custosOperacionais.valor_frete,
        diarias_aluguel_carro: custosOperacionais.diarias_aluguel_carro,
        quantidade_alimentacao: custosOperacionais.quantidade_alimentacao,
        desconto_percentual_extra: custosOperacionais.desconto_percentual_extra ?? undefined,
      };

      const resposta = await fetch("/api/calcular-orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calcInput),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.error ?? "Erro ao calcular o orçamento.");
        return;
      }

      setResultadoOrcamento(dados);
      router.push("/novo-orcamento/step-5-revisao");
    } finally {
      setSalvando(null);
    }
  }

  const financeiro = resultadoTermicoQuenteAtual?.financeiro;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">4. Preços {itens.length > 0 && `— trecho ${itens.length + 1}`}</h1>
        <p className="text-sm text-gray-500">
          Preços de materiais vêm do catálogo de{" "}
          <a href="/config-precos" className="text-brand hover:underline">
            Configuração de Preços
          </a>
          . Clique no lápis de qualquer linha pra ajustar quantidade/preço/unidade só deste orçamento (sem alterar o
          catálogo), ou na lixeira pra excluir a linha inteira do trecho.
        </p>
      </div>

      {!temResultado && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Volte ao passo anterior e calcule as especificações deste trecho.
        </p>
      )}

      {temResultado && (
        <>
          <div className="card space-y-3 text-sm">
            <h2 className="text-lg font-semibold">Resumo técnico</h2>
            <p>Metragem total: <strong>{formatarNumero(metragem, 2)} m²</strong></p>

            {materialCustomizado && (
              <p className="text-amber-600">
                ⚠️ Material customizado neste trecho — sem saídas técnicas (perda térmica/economia), só quantificação
                e preço.
              </p>
            )}

            {!materialCustomizado && resultadoTermicoQuenteAtual && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Análise térmica (cálculos de referência)</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <BoxResumo titulo="Temperatura">
                    <LinhaResumo label="Face fria" valor={`${formatarNumero(resultadoTermicoQuenteAtual.temperatura_face_fria, 1)} °C`} />
                  </BoxResumo>
                  <BoxResumo titulo="Perda de energia">
                    <LinhaResumo label="Com isolante" valor={`${formatarNumero(resultadoTermicoQuenteAtual.perda_com_isolante_kw_m2, 3)} kW/m²`} />
                    <LinhaResumo label="Sem isolante" valor={`${formatarNumero(resultadoTermicoQuenteAtual.perda_sem_isolante_kw_m2, 3)} kW/m²`} />
                    {financeiro && <LinhaResumo label="Redução" valor={`${formatarNumero(financeiro.reducao_percentual, 1)}%`} />}
                  </BoxResumo>
                  {financeiro && (
                    <BoxResumo titulo="Economia e sustentabilidade">
                      <LinhaResumo label="Anual" valor={formatarMoeda(financeiro.economia_anual)} />
                      <LinhaResumo label="Mensal" valor={formatarMoeda(financeiro.economia_mensal)} />
                      <LinhaResumo label="CO₂ evitado/ano" valor={`${formatarNumero(financeiro.co2_ton_ano, 2)} t`} />
                    </BoxResumo>
                  )}
                </div>
              </>
            )}

            {!materialCustomizado && resultadoTermicoFrioAtual && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BoxResumo titulo="Ponto de orvalho">
                  <LinhaResumo label="Temperatura" valor={`${formatarNumero(resultadoTermicoFrioAtual.temperatura_orvalho, 1)} °C`} />
                </BoxResumo>
                {resultadoTermicoFrioAtual.espessura_minima_mm != null && (
                  <BoxResumo titulo="Espessura mínima">
                    <LinhaResumo label="Isolante" valor={`${formatarNumero(resultadoTermicoFrioAtual.espessura_minima_mm, 1)} mm`} />
                  </BoxResumo>
                )}
              </div>
            )}
          </div>

          {tipoProposta === "somente_mo" ? (
            <div className="card rounded-lg bg-brand-light/40 p-4 text-sm text-brand">
              Proposta "Somente Mão de Obra" — quantificação/preço de material não entram neste orçamento.
            </div>
          ) : (
            <div className="card space-y-2">
              <h2 className="text-lg font-semibold">Quantificação de materiais e mão de obra</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="py-2 pr-4 text-left">Material</th>
                      <th className="py-2 pr-4 text-right">Qtd.</th>
                      <th className="py-2 pr-4 text-right">Preço unit.</th>
                      <th className="py-2 pr-4 text-right">Subtotal</th>
                      <th className="py-2 pl-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {/* Camadas de isolante compostas (migração 025) — sem lápis, ver
                        comentário em `linhasIsolanteComposto`. */}
                    {linhasIsolanteComposto.map((l, index) => (
                      <tr key={`isolante-composto-${index}`}>
                        <td className="py-1.5 pr-4">{l.titulo}</td>
                        <td className="py-1.5 pr-4 text-right text-gray-500">{formatarNumero(l.quantidade, 2)} m²</td>
                        <td className="py-1.5 pr-4 text-right text-gray-500">{formatarMoeda(l.precoUnitario)}</td>
                        <td className="py-1.5 pr-4 text-right font-medium">{formatarMoeda(l.subtotal)}</td>
                        <td className="py-1.5 pl-4 text-right" />
                      </tr>
                    ))}
                    {linhas
                      .filter((l) => !estaRemovida(l.chave))
                      .map((l) => (
                        <LinhaTabela
                          key={l.chave}
                          linha={l}
                          quantidade={valor(l.chave, "quantidade", l.quantidadeBase)}
                          unidade={unidadeAtual(l.chave, l.unidadeQuantidade)}
                          precoUnitario={valor(l.chave, "precoUnitario", l.precoBase)}
                          onEditar={() => setEditando(l)}
                          onExcluir={() => excluirLinha(l.chave)}
                        />
                      ))}
                  </tbody>
                </table>
              </div>
              {usaComposicaoIsolante && (
                <p className="text-xs text-gray-400">
                  Espessura exigida ({formatarNumero(espessuraMm, 1)}mm) composta com as espessuras padrão da família — sem lápis
                  aqui; ajuste o preço de cada espessura em Configurar Preços ou use "Itens Adicionais" pra uma correção pontual.
                </p>
              )}
              <p className="text-xs text-gray-400">
                Preços de Rebite/Parafuso/Arame/Silicone vêm do catálogo ("Materiais Adicionais" em Configurar
                Preços) — o lápis ajusta quantidade/preço/unidade só deste orçamento; a lixeira remove a linha
                inteira do trecho (ex.: não vai usar Arame neste trecho).
              </p>
              {linhas.some((l) => estaRemovida(l.chave)) && (
                <p className="text-xs text-gray-400">
                  Removido{linhas.filter((l) => estaRemovida(l.chave)).length > 1 ? "s" : ""} deste trecho:{" "}
                  {linhas
                    .filter((l) => estaRemovida(l.chave))
                    .map((l, i, arr) => (
                      <span key={l.chave}>
                        {l.titulo}{" "}
                        <button type="button" className="text-brand hover:underline" onClick={() => restaurarLinha(l.chave)}>
                          restaurar
                        </button>
                        {i < arr.length - 1 ? " · " : ""}
                      </span>
                    ))}
                </p>
              )}
              <div className="border-t border-gray-100 pt-2 text-sm font-semibold">
                <Linha label="Subtotal Materiais" valor={subtotalMaterialCatalogo} />
              </div>
            </div>
          )}

          {base && config && (
            <div className="card space-y-2">
              <h2 className="text-lg font-semibold">Mão de obra</h2>
              <p className="text-xs text-gray-400">
                Automática: {formatarNumero(metragem, 2)} m² ÷ {formatarNumero(config.m2_por_hora_dupla, 2)} m²/h, eficiência{" "}
                {formatarNumero(base.eficiencia_global * 100, 1)}%
                {especificacoes.trabalho_altura && " (inclui trabalho em altura)"}. Ajustável no lápis, se precisar.
              </p>

              {/* Horas úteis por dia deste orçamento (pedido explícito): as
                  "horas úteis" de Configurar Preços são as horas TOTAIS pagas
                  por dia — deslocamento/liberação de acesso no local podem
                  reduzir quantas dessas horas são de fato produtivas, o que
                  aumenta o prazo de execução real. Ajustável aqui, caso a
                  caso, sem mexer no padrão global. Só afeta o prazo de
                  execução exibido na Proposta, nunca o valor financeiro —
                  fica na parte de Mão de Obra (pedido explícito), acima do
                  valor calculado. */}
              <div>
                <label className="label-field">Horas úteis de serviço por dia (este orçamento)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input-field max-w-xs"
                  placeholder={config ? `Padrão: ${formatarNumero(config.horas_uteis_dia, 1)}h` : "—"}
                  value={horasUteisDiaOverride ?? ""}
                  onChange={(e) => setHorasUteisDiaOverride(e.target.value ? Number(e.target.value) : null)}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Das horas pagas por dia, quantas são realmente produtivas depois de descontar deslocamento e
                  liberação de acesso no local — deixe em branco para usar o padrão de Configurar Preços. Só afeta o
                  prazo de execução estimado na Proposta, não o valor do orçamento.
                </p>
              </div>

              {estaRemovida("maoObra") ? (
                <p className="text-sm text-gray-400">
                  Mão de obra excluída deste trecho —{" "}
                  <button type="button" className="text-brand hover:underline" onClick={() => restaurarLinha("maoObra")}>
                    restaurar
                  </button>
                </p>
              ) : (
                <>
                  <table className="min-w-full text-sm">
                    <tbody>
                      <LinhaTabela
                        linha={{ chave: "maoObra", titulo: "Mão de obra (dupla de 2 profissionais)", unidadeQuantidade: "h", unidadePreco: "hora", quantidadeBase: base.horas_mao_obra, precoBase: base.valor_hora_mao_obra }}
                        quantidade={horasMaoObraEfetiva}
                        unidade={unidadeAtual("maoObra", "h")}
                        precoUnitario={valorHoraEfetivo}
                        onEditar={() =>
                          setEditando({ chave: "maoObra", titulo: "Mão de obra (dupla de 2 profissionais)", unidadeQuantidade: "h", unidadePreco: "hora", quantidadeBase: base.horas_mao_obra, precoBase: base.valor_hora_mao_obra })
                        }
                        onExcluir={() => excluirLinha("maoObra")}
                      />
                    </tbody>
                  </table>
                  <div className="border-t border-gray-100 pt-2 text-sm font-semibold">
                    <Linha label="Subtotal Mão de Obra" valor={subtotalMaoObraHoras} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Itens Adicionais (migração 025/026): pra casos fora do catálogo/
              quantificação automática — andaime, linha de vida, etc. Nome,
              quantidade, preço unitário e categoria (Material ou Execução)
              digitados direto; entra no subtotal correspondente do trecho
              (imposto/margem incidem em cima também) e aparece no quadro de
              materiais e mão de obra da Proposta. */}
          <div className="card space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Itens Adicionais</h2>
              <p className="text-xs text-gray-400">
                Pra itens fora da lista padrão (andaime, linha de vida, etc.) — quantidade e preço direto, sem
                passar pelo catálogo. Marque se é Material ou Execução (ex.: andaime é execução, não material) —
                decide em qual subtotal do trecho o item entra. Entra no total do trecho e aparece na proposta.
              </p>
            </div>

            {itensAdicionais.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="py-2 pr-4 text-left">Item</th>
                      <th className="py-2 pr-4 text-left">Tipo</th>
                      <th className="py-2 pr-4 text-right">Qtd.</th>
                      <th className="py-2 pr-4 text-right">Preço unit.</th>
                      <th className="py-2 pr-4 text-right">Subtotal</th>
                      <th className="py-2 pl-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itensAdicionais.map((it) => (
                      <tr key={it.id}>
                        <td className="py-1.5 pr-4">{it.nome}</td>
                        <td className="py-1.5 pr-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              it.categoria === "material" ? "bg-accent-light text-accent-dark" : "bg-brand-light text-brand"
                            }`}
                          >
                            {it.categoria === "material" ? "Material" : "Execução"}
                          </span>
                        </td>
                        <td className="py-1.5 pr-4 text-right text-gray-500">
                          {formatarNumero(it.quantidade, 2)} {it.unidade}
                        </td>
                        <td className="py-1.5 pr-4 text-right text-gray-500">{formatarMoeda(it.precoUnitario)}</td>
                        <td className="py-1.5 pr-4 text-right font-medium">{formatarMoeda(it.quantidade * it.precoUnitario)}</td>
                        <td className="py-1.5 pl-4 text-right">
                          <button type="button" title="Remover" className="hover:opacity-70" onClick={() => removerItemAdicional(it.id)}>
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:items-end">
              <div className="sm:col-span-2">
                <label className="label-field">Descrição</label>
                <input
                  className="input-field"
                  placeholder="Ex: Andaime, Linha de vida..."
                  value={novoItemAdicional.nome}
                  onChange={(e) => setNovoItemAdicional((prev) => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Tipo</label>
                <select
                  className="input-field"
                  value={novoItemAdicional.categoria}
                  onChange={(e) => setNovoItemAdicional((prev) => ({ ...prev, categoria: e.target.value as "material" | "execucao" }))}
                >
                  <option value="material">Material</option>
                  <option value="execucao">Execução</option>
                </select>
              </div>
              <div>
                <label className="label-field">Qtd.</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={novoItemAdicional.quantidade}
                  onChange={(e) => setNovoItemAdicional((prev) => ({ ...prev, quantidade: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Unidade</label>
                <input
                  className="input-field"
                  placeholder="un."
                  value={novoItemAdicional.unidade}
                  onChange={(e) => setNovoItemAdicional((prev) => ({ ...prev, unidade: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-field">Preço unit. (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={novoItemAdicional.precoUnitario}
                  onChange={(e) => setNovoItemAdicional((prev) => ({ ...prev, precoUnitario: e.target.value }))}
                />
              </div>
            </div>
            <button type="button" className="btn-secondary" onClick={adicionarItemAdicional}>
              + Adicionar item
            </button>

            {itensAdicionais.length > 0 && (
              <div className="border-t border-gray-100 pt-2 text-sm">
                <Linha label="Subtotal Material (adicionais)" valor={subtotalItensAdicionaisMaterial} />
                <Linha label="Subtotal Execução (adicionais)" valor={subtotalItensAdicionaisExecucao} />
                <Linha label="Subtotal Itens Adicionais" valor={subtotalItensAdicionais} destaque />
              </div>
            )}
          </div>

          {/* Custos operacionais: movidos da Revisão pra cá (pedido
              explícito) — valem pro orçamento inteiro, não só este trecho;
              o resumo financeiro final continua exibido na Revisão. */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Custos operacionais adicionais</h2>
            <p className="text-xs text-gray-400">Valem para o orçamento inteiro (todos os trechos juntos).</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="label-field">Alimentação (quantidade)</label>
                <input
                  type="number"
                  className="input-field"
                  value={custosOperacionais.quantidade_alimentacao}
                  onChange={(e) => setCustosOperacionais({ quantidade_alimentacao: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Deslocamento (km)</label>
                <input
                  type="number"
                  className="input-field"
                  value={custosOperacionais.km_deslocamento}
                  onChange={(e) => setCustosOperacionais({ km_deslocamento: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Aluguel de carro (diárias)</label>
                <input
                  type="number"
                  className="input-field"
                  value={custosOperacionais.diarias_aluguel_carro}
                  onChange={(e) => setCustosOperacionais({ diarias_aluguel_carro: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Hospedagem (noites)</label>
                <input
                  type="number"
                  className="input-field"
                  value={custosOperacionais.noites_hospedagem}
                  onChange={(e) => setCustosOperacionais({ noites_hospedagem: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Frete (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={custosOperacionais.valor_frete ?? 0}
                  onChange={(e) => setCustosOperacionais({ valor_frete: Number(e.target.value) })}
                />
              </div>
            </div>
            {/* Aluguel de carro/Alimentação usam o preço por diária definido
                em Configurar Preços — aqui só a quantidade. */}
            <p className="text-xs text-gray-400">
              Aluguel de carro e Alimentação usam o valor por diária definido em{" "}
              <a href="/config-precos" className="text-brand hover:underline">
                Configurar Preços
              </a>
              .
            </p>
          </div>

          <div className="card flex items-center justify-between border-t-4 border-t-accent">
            <span className="font-montserrat text-sm font-bold uppercase text-brand">Valor total deste trecho</span>
            <span className="font-montserrat text-2xl font-bold text-accent">{formatarMoeda(subtotalTrecho)}</span>
          </div>
        </>
      )}

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-3-especificacoes")}>
          ← Voltar
        </button>
        <button type="button" className="btn-primary" disabled={!base || salvando !== null} onClick={irParaRevisao}>
          {salvando === "revisao" ? "Calculando..." : "Próximo →"}
        </button>
      </div>

      {editando && (
        <ModalEditarLinha
          linha={editando}
          quantidadeAtual={valor(editando.chave, "quantidade", editando.quantidadeBase)}
          precoAtual={valor(editando.chave, "precoUnitario", editando.precoBase)}
          unidadeAtual={unidadeAtual(editando.chave, editando.unidadeQuantidade)}
          onFechar={() => setEditando(null)}
          onSalvar={(quantidade, precoUnitario, unidade) => {
            setOverrides((prev) => ({ ...prev, [editando.chave]: { quantidade, precoUnitario, unidade } }));
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function Linha({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`flex justify-between ${destaque ? "border-t border-gray-200 pt-2 font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{formatarMoeda(valor)}</span>
    </div>
  );
}

function BoxResumo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="mb-1 text-xs font-semibold uppercase text-gray-500">{titulo}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function LinhaResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{valor}</span>
    </div>
  );
}

function LinhaTabela({
  linha,
  quantidade,
  unidade,
  precoUnitario,
  onEditar,
  onExcluir,
}: {
  linha: LinhaEdicao;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <tr>
      <td className="py-1.5 pr-4">{linha.titulo}</td>
      <td className="py-1.5 pr-4 text-right text-gray-500">
        {formatarNumero(quantidade, unidade === "g" || unidade === "h" ? 1 : 2)} {unidade}
      </td>
      <td className="py-1.5 pr-4 text-right text-gray-500">{formatarMoeda(precoUnitario)}</td>
      <td className="py-1.5 pr-4 text-right font-medium">{formatarMoeda(quantidade * precoUnitario)}</td>
      <td className="py-1.5 pl-4 text-right space-x-2">
        <button type="button" title="Editar" className="hover:opacity-70" onClick={onEditar}>
          ✏️
        </button>
        <button type="button" title="Excluir deste trecho" className="hover:opacity-70" onClick={onExcluir}>
          🗑️
        </button>
      </td>
    </tr>
  );
}

function ModalEditarLinha({
  linha,
  quantidadeAtual,
  precoAtual,
  unidadeAtual,
  onFechar,
  onSalvar,
}: {
  linha: LinhaEdicao;
  quantidadeAtual: number;
  precoAtual: number;
  unidadeAtual: string;
  onFechar: () => void;
  onSalvar: (quantidade: number, precoUnitario: number, unidade: string) => void;
}) {
  const [quantidade, setQuantidade] = useState(String(quantidadeAtual));
  const [preco, setPreco] = useState(String(precoAtual));
  const [unidade, setUnidade] = useState(unidadeAtual);
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const q = Number(quantidade);
    const p = Number(preco);
    const u = unidade.trim();
    if (!(q > 0)) {
      setErro("Quantidade precisa ser maior que zero.");
      return;
    }
    if (!(p >= 0)) {
      setErro("Preço não pode ser negativo.");
      return;
    }
    if (!u) {
      setErro("Informe a unidade de medida.");
      return;
    }
    onSalvar(q, p, u);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">Editar {linha.titulo}</h2>

        <div className="space-y-3">
          <div>
            <label className="label-field">Quantidade</label>
            <input type="number" step="0.01" className="input-field" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <div>
            <label className="label-field">Unidade de medida</label>
            <input className="input-field" placeholder="Ex.: m², un., kg, verba..." value={unidade} onChange={(e) => setUnidade(e.target.value)} />
          </div>
          <div>
            <label className="label-field">Preço por {unidade.trim() || linha.unidadePreco} (R$)</label>
            <input type="number" step="0.01" className="input-field" value={preco} onChange={(e) => setPreco(e.target.value)} />
          </div>
          <p className="text-sm text-gray-500">Subtotal: {formatarMoeda(Number(quantidade || 0) * Number(preco || 0))}</p>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar}>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
