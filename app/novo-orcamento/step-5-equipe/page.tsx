"use client";

import { Carregando } from "@/components/ui/Esqueleto";
import { useRouter } from "next/navigation";
import EquipeMaoObra from "@/components/EquipeMaoObra";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import { useOrcamentoCalculado } from "@/lib/hooks/useOrcamentoCalculado";
import { useWizardStore } from "@/lib/store";
import { catalogoItensExecucao, quantidadeInicialItemExecucao, totalItensExecucao } from "@/lib/usecases/orcamento";

/** Etapa 5 — o que vale para o ORÇAMENTO INTEIRO, uma vez só: a equipe de mão
 * de obra (com as diárias) e os custos operacionais. Antes esses quadros
 * ficavam na Tela 4 e se repetiam a cada trecho. Tudo aqui é recalculado na
 * hora (ver lib/hooks/useOrcamentoCalculado.ts) — a barra de totais no rodapé
 * acompanha. */
export default function Step5EquipePage() {
  const router = useRouter();
  const { itens, custosOperacionais, setCustosOperacionais, editarItem, margemPercentual, setMargemPercentual, descontoValor, setDescontoValor } =
    useWizardStore();
  const { config, trechos, maoObra, itensExecucao, resultado, erro } = useOrcamentoCalculado();
  const { execucaoPadrao, setItemExecucao } = useWizardStore();
  const catalogo = catalogoItensExecucao(config?.itens_execucao_padrao);

  // Voltar = reabrir o último trecho na Tela 4, com os ajustes dele.
  function voltarAoUltimoTrecho() {
    editarItem(itens.length - 1);
    router.push("/novo-orcamento/step-4-precos");
  }

  if (itens.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">5. Equipe e custos</h1>
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Ainda não há nenhum trecho neste orçamento. Comece pelo Escopo (passo 2) e salve ao menos um trecho.
        </p>
        <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-2-escopo")}>
          ← Ir para o Escopo
        </button>
      </div>
    );
  }

  const campo = (label: string, chave: "quantidade_alimentacao" | "km_deslocamento" | "diarias_aluguel_carro" | "noites_hospedagem" | "valor_frete", valor: number | undefined, passo?: string) => (
    <div>
      <label className="label-field">{label}</label>
      <input
        type="number"
        min={0}
        step={passo}
        className="input-field"
        value={custosOperacionais[chave] ?? 0}
        onChange={(e) => setCustosOperacionais({ [chave]: Math.max(0, Number(e.target.value) || 0) })}
      />
      <p className="mt-1 text-xs text-gray-500">{valor != null ? formatarMoeda(valor) : "—"}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">5. Equipe e custos</h1>
        <p className="text-sm text-gray-500">Valem para o orçamento inteiro — todos os trechos juntos.</p>
      </div>

      <div className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {itens.length} {itens.length === 1 ? "trecho" : "trechos"} neste orçamento
          </h2>
          <button type="button" className="btn-secondary" onClick={() => router.push("/novo-orcamento/step-2-escopo")}>
            + Adicionar outro trecho
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="table-header">
              <tr>
                <th className="py-2 pr-4 text-left">Trecho</th>
                <th className="py-2 pr-4 text-right">Metragem</th>
                <th className="py-2 pr-4 text-right">Trabalho</th>
                <th className="py-2 pr-4 text-right">Horas de obra</th>
                <th className="py-2 pr-4 text-right">Materiais</th>
                <th className="py-2 text-right">Execução</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itens.map((item, index) => {
                const p = trechos[index]?.precificacao ?? item.precificacao;
                return (
                  <tr key={index}>
                    <td className="py-1.5 pr-4">
                      {index + 1} — {item.materialNome}
                    </td>
                    <td className="py-1.5 pr-4 text-right text-gray-500">{formatarNumero(p.metragem_m2, 2)} m²</td>
                    <td className="py-1.5 pr-4 text-right text-gray-500">{formatarNumero(p.m2_equivalente_mao_obra ?? 0, 2)} m² eq.</td>
                    <td className="py-1.5 pr-4 text-right text-gray-500">{formatarNumero(p.horas_mao_obra, 1)} h</td>
                    <td className="py-1.5 pr-4 text-right">{formatarMoeda(p.subtotal_material)}</td>
                    <td className="py-1.5 text-right">{formatarMoeda(p.subtotal_mao_obra)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">"Execução" de cada trecho = a parte dele na mão de obra da equipe + os itens adicionais de execução dele.</p>
      </div>

      {config && maoObra ? <EquipeMaoObra config={config} maoObra={maoObra} /> : <Carregando />}

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Custos operacionais</h2>
          <p className="text-xs text-gray-500">
            Informe só as quantidades — os valores unitários vêm de{" "}
            <a href="/config-precos" className="text-brand hover:underline">
              Configurações do orçamento
            </a>
            . O frete é digitado direto em R$.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {campo("Alimentação (diárias)", "quantidade_alimentacao", resultado?.valor_alimentacao)}
          {campo("Deslocamento (km)", "km_deslocamento", resultado?.valor_deslocamento)}
          {campo("Aluguel de carro (diárias)", "diarias_aluguel_carro", resultado?.valor_aluguel_carro)}
          {campo("Hospedagem (noites)", "noites_hospedagem", resultado?.valor_hospedagem)}
          {campo("Frete (R$)", "valor_frete", resultado?.valor_frete, "0.01")}
        </div>
        {maoObra && maoObra.pessoas > 0 && maoObra.dias > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-light/40 px-4 py-2 text-sm text-brand">
            <span>
              Equipe de {maoObra.pessoas} {maoObra.pessoas === 1 ? "pessoa" : "pessoas"} × {maoObra.dias} {maoObra.dias === 1 ? "dia" : "dias"} de obra ={" "}
              <strong>{maoObra.pessoas * maoObra.dias} diárias de alimentação</strong>.
            </span>
            {custosOperacionais.quantidade_alimentacao !== maoObra.pessoas * maoObra.dias && (
              <button type="button" className="font-medium hover:underline" onClick={() => setCustosOperacionais({ quantidade_alimentacao: maoObra.pessoas * maoObra.dias })}>
                Usar essa quantidade
              </button>
            )}
          </div>
        )}
      </div>

      {/* Itens de execução padrão (migração 051) — equipamentos e serviços
          de apoio do catálogo de Configurações do orçamento: basta habilitar. O que
          fica habilitado entra em "O orçamento contempla" na proposta; o que
          não fica é citado em "Não contemplado". */}
      {config && (
        <div className="card space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Itens de execução</h2>
            <p className="text-xs text-gray-500">
              Marque o que esta obra inclui. Na proposta, os marcados entram em "O orçamento contempla" e no quadro de itens de execução;
              os não marcados são citados em "Não contemplado".
            </p>
          </div>
          {catalogo.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum item cadastrado. Monte a lista (andaime, plataforma elevatória, guindauto...) em{" "}
              <a href="/config-precos" className="text-brand hover:underline">
                Configurações do orçamento → Mão de Obra → Itens de execução padrão
              </a>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="table-header">
                  <tr>
                    <th className="py-2 pr-4 text-left">Incluir</th>
                    <th className="py-2 pr-4 text-left">Item</th>
                    <th className="py-2 pr-4 text-left">Quantidade</th>
                    <th className="py-2 pr-4 text-left">Preço unit. (R$)</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {catalogo.map((item) => {
                    const escolha = execucaoPadrao[item.id];
                    const incluido = !!escolha?.incluido;
                    const linha = itensExecucao.find((i) => i.id === item.id);
                    return (
                      <tr key={item.id} className={incluido ? "" : "text-gray-400"}>
                        <td className="py-1.5 pr-4">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            aria-label={`Incluir ${item.nome}`}
                            checked={incluido}
                            onChange={(e) =>
                              setItemExecucao(item.id, {
                                incluido: e.target.checked,
                                // Ao habilitar pela primeira vez: os dias de obra, se o item é por diária.
                                ...(e.target.checked && !escolha ? { quantidade: quantidadeInicialItemExecucao(item, maoObra?.dias ?? 0) } : {}),
                              })
                            }
                          />
                        </td>
                        <td className="py-1.5 pr-4 font-medium">{item.nome}</td>
                        <td className="py-1.5 pr-4">
                          {incluido ? (
                            <span className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                aria-label={`Quantidade de ${item.nome}`}
                                className="input-field w-24"
                                value={escolha?.quantidade ?? 1}
                                onChange={(e) => setItemExecucao(item.id, { quantidade: Math.max(0, Number(e.target.value) || 0) })}
                              />
                              <span className="text-xs text-gray-500">{item.unidade}</span>
                            </span>
                          ) : (
                            <span className="text-xs">{item.unidade}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-4">
                          {incluido ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              aria-label={`Preço de ${item.nome}`}
                              className="input-field w-28"
                              placeholder={String(item.preco)}
                              value={escolha?.precoUnitario ?? ""}
                              onChange={(e) => setItemExecucao(item.id, { precoUnitario: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                            />
                          ) : (
                            formatarMoeda(item.preco)
                          )}
                        </td>
                        <td className="py-1.5 text-right font-medium">{incluido ? formatarMoeda(linha?.subtotal ?? 0) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {catalogo.length > 0 && (
            <div className="flex justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
              <span>Itens de execução incluídos</span>
              <span>{formatarMoeda(totalItensExecucao(itensExecucao))}</span>
            </div>
          )}
          {itensExecucao.some((i) => i.incluido && i.preco_unitario === 0) && (
            <p className="text-xs text-amber-700">Há item incluído com preço R$ 0,00 — informe o preço aqui ou cadastre o padrão em Configurações do orçamento.</p>
          )}
        </div>
      )}

      {/* Margem e desconto deste orçamento — passam pelo mesmo motor de
          cálculo (preço = custo ÷ (1 − impostos − margem); o imposto incide
          sobre o valor final e o desconto sai da margem). */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Margem e desconto</h2>
          <p className="text-xs text-gray-500">Só deste orçamento. Em branco, a margem é a padrão de Configurações do orçamento.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Margem de lucro (% do preço de venda)</label>
            <input
              type="number"
              min={0}
              max={99}
              step="0.01"
              className="input-field max-w-xs"
              placeholder={config ? `Padrão: ${formatarNumero(config.margem_lucro_padrao, 2)}%` : "—"}
              value={margemPercentual ?? ""}
              onChange={(e) => setMargemPercentual(e.target.value === "" ? null : Math.min(99, Math.max(0, Number(e.target.value) || 0)))}
            />
          </div>
          <div>
            <label className="label-field">Desconto (R$)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input-field max-w-xs"
              value={descontoValor || ""}
              placeholder="0,00"
              onChange={(e) => setDescontoValor(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>
        {resultado && (
          <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Custo total</span>
              <span>{formatarMoeda(resultado.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Impostos ({formatarNumero(resultado.percentual_impostos, 2)}% do valor final)</span>
              <span>{formatarMoeda(resultado.total_impostos)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Preço cheio</span>
              <span>{formatarMoeda(resultado.preco_cheio)}</span>
            </div>
            {resultado.valor_desconto > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Desconto</span>
                <span>-{formatarMoeda(resultado.valor_desconto)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">
                Margem de lucro efetiva ({formatarNumero(resultado.percentual_margem, 2)}%{resultado.valor_desconto > 0 ? ", já com o desconto" : ""})
              </span>
              <span className={resultado.margem_lucro < 0 ? "font-semibold text-status-error" : ""}>{formatarMoeda(resultado.margem_lucro)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
              <span>Valor final</span>
              <span>{formatarMoeda(resultado.valor_final)}</span>
            </div>
            {resultado.margem_lucro < 0 && <p className="text-xs text-status-error">O desconto é maior que a margem — este orçamento dá prejuízo.</p>}
          </div>
        )}
      </div>

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={voltarAoUltimoTrecho}>
          ← Voltar ao último trecho
        </button>
        <button type="button" className="btn-primary" onClick={() => router.push("/novo-orcamento/step-6-revisao")}>
          Próximo →
        </button>
      </div>
    </div>
  );
}
