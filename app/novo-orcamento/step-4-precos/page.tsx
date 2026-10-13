"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWizardStore, type ChaveLinhaAjuste, type ItemAdicional, type OverrideLinha } from "@/lib/store";
import { comporCamadasIsolante, precificarTrecho, precoAcessorioPorUnidade, somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { ConfigEmpresa, PrecoConfig } from "@/lib/types";
import BarraTotais from "@/components/orcamento/BarraTotais";
import Explicacao from "@/components/ui/Explicacao";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";

/** Preço de um acessório por unidade de quantidade — Rebite/Parafuso vêm do
 * catálogo "por centena" e são convertidos (ver precoAcessorio.ts). */
const precoAcessorio = precoAcessorioPorUnidade;

// Os ajustes manuais desta tela (lápis, linhas excluídas e itens adicionais)
// ficam no estado do wizard — ver `AjustesTrecho` em lib/store.ts.
type ChaveLinha = ChaveLinhaAjuste;

interface LinhaEdicao {
  chave: ChaveLinha;
  titulo: string;
  unidadeQuantidade: string;
  unidadePreco: string;
  quantidadeBase: number;
  precoBase: number;
}

/** Tela 4 — preços de UM trecho: resumo técnico, quantificação de materiais
 * (com lápis/lixeira por linha), o trabalho de mão de obra que o trecho dá e
 * os itens adicionais dele. O que vale para o orçamento inteiro — equipe,
 * diárias e custos operacionais — fica na etapa seguinte ("Equipe e custos"),
 * uma vez só, em vez de se repetir a cada trecho. */
export default function Step4PrecosPage() {
  const router = useRouter();
  const {
    itemAtual: especificacoes,
    escopoAtual,
    resultadoTermicoQuenteAtual,
    resultadoTermicoFrioAtual,
    itens,
    tipoProposta,
    ajustesAtual,
    setAjustesAtual,
    confirmarItemAtual,
  } = useWizardStore();

  const [precos, setPrecos] = useState<PrecoConfig[]>([]);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [editando, setEditando] = useState<LinhaEdicao | null>(null);

  // Ajustes do trecho, guardados no estado do wizard. As duas funções abaixo
  // têm a mesma forma de um `setState`, pra o resto da tela não mudar.
  const overrides = ajustesAtual.overrides;
  const itensAdicionais = ajustesAtual.itensAdicionais;
  type Overrides = typeof overrides;
  function setOverrides(atualizar: (anterior: Overrides) => Overrides) {
    setAjustesAtual({ overrides: atualizar(useWizardStore.getState().ajustesAtual.overrides) });
  }
  function setItensAdicionais(atualizar: (anterior: ItemAdicional[]) => ItemAdicional[]) {
    setAjustesAtual({ itensAdicionais: atualizar(useWizardStore.getState().ajustesAtual.itensAdicionais) });
  }
  const [novoItemAdicional, setNovoItemAdicional] = useState<{
    nome: string;
    quantidade: string;
    precoUnitario: string;
    unidade: string;
    categoria: "material" | "execucao";
  }>({ nome: "", quantidade: "1", precoUnitario: "", unidade: "un.", categoria: "material" });

  useEffect(() => {
    Promise.all([fetch("/api/precos-config").then((r) => r.json()), fetch("/api/config-empresa").then((r) => r.json())]).then(([p, c]) => {
      setPrecos(p);
      setConfig(c);
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

  // Mão de obra (migração 048): é da PROPOSTA inteira — equipe × dias
  // fechados (ver lib/usecases/orcamento/maoObraEquipe.ts), escolhida na
  // etapa "Equipe e custos". Este trecho só contribui com o trabalho dele (m²
  // equivalentes = metragem ÷ eficiência); "excluir" a mão de obra do trecho
  // zera essa contribuição. Horas e valor da equipe são repartidos entre os
  // trechos na hora de calcular (lib/hooks/useOrcamentoCalculado.ts) — aqui o
  // subtotal de execução do trecho leva só os itens adicionais de categoria
  // "execucao" (andaime, linha de vida...).
  const m2EquivalenteTrecho = base && !estaRemovida("maoObra") ? base.m2_equivalente_mao_obra : 0;
  const subtotalMaoObra = subtotalItensAdicionaisExecucao;
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
        horas_mao_obra: 0,
        m2_equivalente_mao_obra: m2EquivalenteTrecho,
        subtotal_itens_execucao: subtotalItensAdicionaisExecucao,
        subtotal_material: subtotalMaterial,
        subtotal_mao_obra: subtotalMaoObra,
        subtotal_trecho: subtotalTrecho,
        detalhamentoMateriais: detalhamentoFinal,
      },
    };
  }

  /** Salva o trecho no orçamento e segue: para a equipe e os custos, ou
   * para o Escopo de um novo trecho. */
  function salvarTrecho(destino: "equipe" | "novo-trecho") {
    const payload = montarPayloadConfirmacao();
    if (!payload) return;
    confirmarItemAtual(payload);
    router.push(destino === "equipe" ? "/novo-orcamento/step-5-equipe" : "/novo-orcamento/step-2-escopo");
  }

  // Trecho em edição já com os ajustes desta tela — entra na barra de totais
  // como se estivesse salvo.
  const rascunho = montarPayloadConfirmacao()?.precificacao ?? null;
  const semTrechoEmEdicao = escopoAtual.length === 0;

  const financeiro = resultadoTermicoQuenteAtual?.financeiro;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">4. Preços {itens.length > 0 && `— trecho ${itens.length + 1}`}</h1>
        <p className="text-sm text-gray-500">
          Materiais e itens adicionais deste trecho. O lápis ajusta uma linha só neste orçamento; a lixeira tira a linha do
          trecho.
        </p>
      </div>

      {semTrechoEmEdicao && itens.length > 0 && (
        <div className="card space-y-3">
          <p className="text-sm text-gray-700">
            {itens.length === 1 ? "O trecho já foi salvo" : `Os ${itens.length} trechos já foram salvos`} neste orçamento. Para mudar os
            preços de um trecho, use "Editar" na Revisão.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-2-escopo")}>
              + Adicionar outro trecho
            </button>
            <button type="button" className="btn-primary" onClick={() => router.push("/novo-orcamento/step-5-equipe")}>
              Ir para Equipe e custos →
            </button>
          </div>
        </div>
      )}

      {!semTrechoEmEdicao && !temResultado && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Volte ao passo anterior e calcule as especificações deste trecho.
        </p>
      )}
      {semTrechoEmEdicao && itens.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">Comece pelo Escopo (passo 2): adicione os itens do trecho.</p>
      )}

      {!semTrechoEmEdicao && temResultado && (
        <>
          <div className="card space-y-3 text-sm">
            <h2 className="text-lg font-semibold">Resumo técnico</h2>
            <p>Metragem total: <strong>{formatarNumero(metragem, 2)} m²</strong></p>

            {materialCustomizado && (
              <p className="text-amber-600">
                <AlertTriangle className="icone" aria-hidden /> Material customizado neste trecho — sem saídas técnicas (perda térmica/economia), só quantificação
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
              <h2 className="text-lg font-semibold">Quantificação de materiais</h2>
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
              <Explicacao titulo="De onde vêm estes números">
                <p>
                  Quantidades calculadas a partir do Escopo e dos parâmetros de quantificação; preços do catálogo, em{" "}
                  <a href="/config-precos" className="text-brand hover:underline">
                    Configurar Preços
                  </a>{" "}
                  (Rebite, Parafuso, Arame e Silicone ficam em "Materiais Adicionais").
                </p>
                <p>O lápis ajusta quantidade, preço e unidade só neste orçamento, sem alterar o catálogo. A lixeira remove a linha do trecho (ex.: não vai usar Arame aqui).</p>
              </Explicacao>
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
              <h2 className="text-lg font-semibold">Trabalho de mão de obra deste trecho</h2>
              {estaRemovida("maoObra") ? (
                <p className="text-sm text-gray-400">
                  Mão de obra excluída deste trecho — ele não conta nos dias de obra.{" "}
                  <button type="button" className="text-brand hover:underline" onClick={() => restaurarLinha("maoObra")}>
                    restaurar
                  </button>
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    <strong>{formatarNumero(metragem, 2)} m²</strong> ÷ eficiência média{" "}
                    <strong>{formatarNumero(base.eficiencia_global * 100, 1)}%</strong>
                    {especificacoes.trabalho_altura && " (inclui trabalho em altura)"} ={" "}
                    <strong>{formatarNumero(m2EquivalenteTrecho, 2)} m² equivalentes</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    A equipe, os dias e o valor da mão de obra são definidos uma vez para o orçamento inteiro, na próxima etapa.{" "}
                    <button type="button" className="text-brand hover:underline" onClick={() => excluirLinha("maoObra")}>
                      Excluir a mão de obra deste trecho
                    </button>
                  </p>
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
              <p className="text-xs text-gray-500">Itens fora do catálogo, com quantidade e preço digitados direto.</p>
              <Explicacao titulo="Material ou Execução?">
                <p>
                  "Material" soma com os materiais do trecho e aparece no quadro de Materiais da proposta. "Execução" (andaime,
                  linha de vida, remoção de isolamento...) soma com a mão de obra e aparece no quadro "Itens Adicionais de
                  Execução".
                </p>
              </Explicacao>
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
                          <button type="button" title="Remover" aria-label="Remover" className="hover:opacity-70" onClick={() => removerItemAdicional(it.id)}>
                            <Trash2 className="icone" aria-hidden />
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

          <div className="card flex flex-wrap items-center justify-between gap-2 border-t-4 border-t-accent">
            <span>
              <span className="block font-montserrat text-sm font-bold uppercase text-brand">Subtotal deste trecho</span>
              <span className="block text-xs text-gray-500">Materiais e itens adicionais — a mão de obra da equipe entra na próxima etapa.</span>
            </span>
            <span className="font-montserrat text-2xl font-bold text-accent">{formatarMoeda(subtotalTrecho)}</span>
          </div>
        </>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-3-especificacoes")}>
          ← Voltar
        </button>
        {!semTrechoEmEdicao && (
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" disabled={!base} onClick={() => salvarTrecho("novo-trecho")}>
              Salvar e adicionar outro trecho
            </button>
            <button type="button" className="btn-primary" disabled={!base} onClick={() => salvarTrecho("equipe")}>
              Próximo →
            </button>
          </div>
        )}
      </div>

      <BarraTotais rascunho={rascunho} />

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
        <button type="button" title="Editar" aria-label="Editar" className="hover:opacity-70" onClick={onEditar}>
          <Pencil className="icone" aria-hidden />
        </button>
        <button type="button" title="Excluir deste trecho" aria-label="Excluir deste trecho" className="hover:opacity-70" onClick={onExcluir}>
          <Trash2 className="icone" aria-hidden />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
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
