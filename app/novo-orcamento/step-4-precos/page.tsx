"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { horasMaoObraTotal, useWizardStore } from "@/lib/store";
import { precificarTrecho, somarMetragemEscopo } from "@/lib/usecases/orcamento";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { CalcularOrcamentoInput, ConfigEmpresa, ImpostoConfig, PrecoConfig } from "@/lib/types";

/** Preço de um acessório do catálogo (migrações 016/017) pela sua
 * `tipo_material` — 0 se ainda não cadastrado em Configurar Preços. */
function precoAcessorio(precos: PrecoConfig[], tipo: string): number {
  return precos.find((p) => p.tipo_material === tipo)?.preco_unitario ?? 0;
}

type ChaveLinha = "isolante" | "acabamento" | "rebite" | "parafuso" | "arame" | "silicone" | "maoObra";

interface OverrideLinha {
  quantidade?: number;
  precoUnitario?: number;
}

interface LinhaEdicao {
  chave: ChaveLinha;
  titulo: string;
  unidadeQuantidade: string;
  unidadePreco: string;
  quantidadeBase: number;
  precoBase: number;
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

  const nomeIsolante = isolanteCustomizado ? especificacoes.isolante_customizado_nome! : precoIsolanteCatalogo?.descricao ?? "Isolante";
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
    arameKg: precoAcessorio(precos, "acessorio_arame"),
    siliconeFrasco: precoAcessorio(precos, "acessorio_silicone"),
  };

  // Baseline: quantificação automática + mão de obra automática (motor da
  // migração 019), ainda SEM os overrides manuais desta tela.
  const base =
    config && temResultado
      ? precificarTrecho({
          escopoItens: escopoAtual,
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

  function valor(chave: ChaveLinha, campo: keyof OverrideLinha, base: number): number {
    return overrides[chave]?.[campo] ?? base;
  }

  const linhas: LinhaEdicao[] = base
    ? [
        { chave: "isolante", titulo: nomeIsolante, unidadeQuantidade: "m²", unidadePreco: "m²", quantidadeBase: base.quantidades.isolanteM2, precoBase: precoIsolanteBase },
        { chave: "acabamento", titulo: nomeAcabamento, unidadeQuantidade: "m²", unidadePreco: "m²", quantidadeBase: base.quantidades.acabamentoM2, precoBase: precoAcabamentoBase },
        { chave: "rebite", titulo: "Rebite", unidadeQuantidade: "un.", unidadePreco: "un.", quantidadeBase: base.quantidades.rebiteUn, precoBase: precosAcessorios.rebiteUn },
        { chave: "parafuso", titulo: "Parafuso", unidadeQuantidade: "un.", unidadePreco: "un.", quantidadeBase: base.quantidades.parafusoUn, precoBase: precosAcessorios.parafusoUn },
        { chave: "arame", titulo: "Arame", unidadeQuantidade: "g", unidadePreco: "g", quantidadeBase: base.quantidades.arameGramas, precoBase: precosAcessorios.arameKg / 1000 },
        { chave: "silicone", titulo: "Silicone", unidadeQuantidade: "frasco(s)", unidadePreco: "frasco", quantidadeBase: base.quantidades.siliconeFrascos, precoBase: precosAcessorios.siliconeFrasco },
      ]
    : [];

  const subtotalMaterial =
    !base || tipoProposta === "somente_mo"
      ? 0
      : Number(linhas.reduce((acc, l) => acc + valor(l.chave, "quantidade", l.quantidadeBase) * valor(l.chave, "precoUnitario", l.precoBase), 0).toFixed(2));

  const horasMaoObraEfetiva = base ? valor("maoObra", "quantidade", base.horas_mao_obra) : 0;
  const valorHoraEfetivo = base ? valor("maoObra", "precoUnitario", base.valor_hora_mao_obra) : 0;
  const subtotalMaoObra = Number((horasMaoObraEfetiva * valorHoraEfetivo).toFixed(2));
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
    const detalhamentoFinal =
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
                unidade: l.unidadeQuantidade,
                preco_unitario: precoUnitario,
                subtotal: Number((quantidade * precoUnitario).toFixed(2)),
              };
            })
            .filter((l) => l.quantidade > 0);

    return {
      materialNome: nomeIsolante,
      acabamentoNome: nomeAcabamento,
      especificacaoIsolante: isolanteCustomizado ? null : precoIsolanteCatalogo?.especificacao ?? null,
      especificacaoAcabamento: acabamentoCustomizado ? null : precoAcabamentoCatalogo?.especificacao ?? null,
      precificacao: {
        ...base,
        preco_isolante_m2: valor("isolante", "precoUnitario", precoIsolanteBase),
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

      const calcInput: CalcularOrcamentoInput = {
        valor_materiais_direto: valorMateriaisTotal,
        config,
        impostosExtras,
        horas_mao_obra: horasMaoObraTotal(todosOsItens),
        km_deslocamento: custosOperacionais.km_deslocamento,
        noites_hospedagem: custosOperacionais.noites_hospedagem,
        toneladas_frete: custosOperacionais.toneladas_frete,
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
          . Clique no lápis de qualquer linha pra ajustar só este orçamento, sem alterar o catálogo.
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
                    {linhas.map((l) => (
                      <LinhaTabela
                        key={l.chave}
                        linha={l}
                        quantidade={valor(l.chave, "quantidade", l.quantidadeBase)}
                        precoUnitario={valor(l.chave, "precoUnitario", l.precoBase)}
                        onEditar={() => setEditando(l)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400">
                Preços de Rebite/Parafuso/Arame/Silicone vêm do catálogo ("Materiais Adicionais" em Configurar
                Preços) — o lápis ajusta só este orçamento.
              </p>
              <div className="border-t border-gray-100 pt-2 text-sm font-semibold">
                <Linha label="Subtotal Materiais" valor={subtotalMaterial} />
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
              <table className="min-w-full text-sm">
                <tbody>
                  <LinhaTabela
                    linha={{ chave: "maoObra", titulo: "Mão de obra (dupla de 2 profissionais)", unidadeQuantidade: "h", unidadePreco: "hora", quantidadeBase: base.horas_mao_obra, precoBase: base.valor_hora_mao_obra }}
                    quantidade={horasMaoObraEfetiva}
                    precoUnitario={valorHoraEfetivo}
                    onEditar={() =>
                      setEditando({ chave: "maoObra", titulo: "Mão de obra (dupla de 2 profissionais)", unidadeQuantidade: "h", unidadePreco: "hora", quantidadeBase: base.horas_mao_obra, precoBase: base.valor_hora_mao_obra })
                    }
                  />
                </tbody>
              </table>
              <div className="border-t border-gray-100 pt-2 text-sm font-semibold">
                <Linha label="Subtotal Mão de Obra" valor={subtotalMaoObra} />
              </div>
            </div>
          )}

          {/* Custos operacionais: movidos da Revisão pra cá (pedido
              explícito) — valem pro orçamento inteiro, não só este trecho;
              o resumo financeiro final continua exibido na Revisão. */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Custos operacionais adicionais</h2>
            <p className="text-xs text-gray-400">Valem para o orçamento inteiro (todos os trechos juntos).</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <label className="label-field">Hospedagem (noites)</label>
                <input
                  type="number"
                  className="input-field"
                  value={custosOperacionais.noites_hospedagem}
                  onChange={(e) => setCustosOperacionais({ noites_hospedagem: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Frete (toneladas)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={custosOperacionais.toneladas_frete}
                  onChange={(e) => setCustosOperacionais({ toneladas_frete: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-field">Desconto extra (%, opcional)</label>
                <input
                  type="number"
                  step="0.1"
                  className="input-field"
                  placeholder="0"
                  value={custosOperacionais.desconto_percentual_extra ?? ""}
                  onChange={(e) => setCustosOperacionais({ desconto_percentual_extra: Number(e.target.value) })}
                />
              </div>
            </div>
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
          onFechar={() => setEditando(null)}
          onSalvar={(quantidade, precoUnitario) => {
            setOverrides((prev) => ({ ...prev, [editando.chave]: { quantidade, precoUnitario } }));
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
  precoUnitario,
  onEditar,
}: {
  linha: LinhaEdicao;
  quantidade: number;
  precoUnitario: number;
  onEditar: () => void;
}) {
  return (
    <tr>
      <td className="py-1.5 pr-4">{linha.titulo}</td>
      <td className="py-1.5 pr-4 text-right text-gray-500">
        {formatarNumero(quantidade, linha.unidadeQuantidade === "g" || linha.unidadeQuantidade === "h" ? 1 : 2)} {linha.unidadeQuantidade}
      </td>
      <td className="py-1.5 pr-4 text-right text-gray-500">{formatarMoeda(precoUnitario)}</td>
      <td className="py-1.5 pr-4 text-right font-medium">{formatarMoeda(quantidade * precoUnitario)}</td>
      <td className="py-1.5 pl-4 text-right">
        <button type="button" title="Editar" className="hover:opacity-70" onClick={onEditar}>
          ✏️
        </button>
      </td>
    </tr>
  );
}

function ModalEditarLinha({
  linha,
  quantidadeAtual,
  precoAtual,
  onFechar,
  onSalvar,
}: {
  linha: LinhaEdicao;
  quantidadeAtual: number;
  precoAtual: number;
  onFechar: () => void;
  onSalvar: (quantidade: number, precoUnitario: number) => void;
}) {
  const [quantidade, setQuantidade] = useState(String(quantidadeAtual));
  const [preco, setPreco] = useState(String(precoAtual));
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const q = Number(quantidade);
    const p = Number(preco);
    if (!(q > 0)) {
      setErro("Quantidade precisa ser maior que zero.");
      return;
    }
    if (!(p >= 0)) {
      setErro("Preço não pode ser negativo.");
      return;
    }
    onSalvar(q, p);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">Editar {linha.titulo}</h2>

        <div className="space-y-3">
          <div>
            <label className="label-field">Quantidade ({linha.unidadeQuantidade})</label>
            <input type="number" step="0.01" className="input-field" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <div>
            <label className="label-field">Preço por {linha.unidadePreco} (R$)</label>
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
