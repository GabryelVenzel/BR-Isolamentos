"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import TabsNavigation from "@/components/TabsNavigation";
import ModalCotacao from "@/components/modules/operacional/compras/ModalCotacao";
import ModalPedidoCompra from "@/components/modules/operacional/compras/ModalPedidoCompra";
import ModalReceberPedido from "@/components/modules/operacional/compras/ModalReceberPedido";
import type { ItemDoCatalogo } from "@/components/modules/operacional/compras/EditorItens";
import { toast } from "@/components/modules/operacional/toast";
import { confirmar } from "@/components/ui/confirmar";
import { LABEL_STATUS_PEDIDO, compararCotacao } from "@/lib/compras";
import type { HistoricoDeItemComCatalogo } from "@/lib/contexts/compras";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { Cotacao, Fornecedor, PedidoCompra, Servico, StatusPedidoCompra } from "@/lib/types/domain";

type Aba = "pedidos" | "cotacoes" | "precos";

const ABAS: Array<{ valor: Aba; label: string }> = [
  { valor: "pedidos", label: "Pedidos de compra" },
  { valor: "cotacoes", label: "Cotações" },
  { valor: "precos", label: "Histórico de preços" },
];

const CLASSE_STATUS: Record<StatusPedidoCompra, string> = {
  rascunho: "bg-gray-100 text-gray-600",
  enviado: "bg-secondary-light text-brand",
  recebido: "bg-accent-light text-accent-dark",
  cancelado: "bg-red-100 text-status-error",
};

const LABEL_STATUS_COTACAO: Record<Cotacao["status"], string> = { aberta: "Aberta", concluida: "Concluída", cancelada: "Cancelada" };

async function buscar<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    const payload = await response.json();
    return response.ok && payload.success ? (payload.data as T) : null;
  } catch {
    return null;
  }
}

/** Operacional → Compras: pedidos a fornecedores, cotações comparadas lado a
 * lado e o histórico de preços pagos por item (migração 044). */
export default function ComprasPage() {
  const [aba, setAba] = useState<Aba>("pedidos");
  const [pedidos, setPedidos] = useState<PedidoCompra[] | null>(null);
  const [cotacoes, setCotacoes] = useState<Cotacao[] | null>(null);
  const [historico, setHistorico] = useState<HistoricoDeItemComCatalogo[] | null>(null);
  const [catalogo, setCatalogo] = useState<ItemDoCatalogo[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [pedidoAberto, setPedidoAberto] = useState<PedidoCompra | "novo" | null>(null);
  const [recebendo, setRecebendo] = useState<PedidoCompra | null>(null);
  const [cotacaoAberta, setCotacaoAberta] = useState<Cotacao | "nova" | null>(null);
  const [itemAberto, setItemAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const [p, c, h] = await Promise.all([
      buscar<PedidoCompra[]>("/api/operacional/compras/pedidos"),
      buscar<Cotacao[]>("/api/operacional/compras/cotacoes"),
      buscar<{ historico: HistoricoDeItemComCatalogo[]; catalogo: ItemDoCatalogo[] }>("/api/operacional/compras/precos"),
    ]);
    if (!p || !c || !h) {
      setErro("Não foi possível carregar as compras. Se a migração 044 ainda não foi aplicada no banco, é esse o motivo.");
      return;
    }
    setPedidos(p);
    setCotacoes(c);
    setHistorico(h.historico);
    setCatalogo(h.catalogo.filter((item) => item.ativo));
  }, []);

  useEffect(() => {
    carregar();
    buscar<Fornecedor[]>("/api/operacional/fornecedores").then((f) => f && setFornecedores(f.filter((x) => x.ativo)));
    buscar<Servico[]>("/api/operacional/servicos").then((s) => s && setServicos(s));
  }, [carregar]);

  async function acaoPedido(pedido: PedidoCompra, acao: "enviar" | "cancelar" | "reabrir") {
    if (acao === "cancelar" && !(await confirmar(`Cancelar o pedido ${pedido.numero}?`, { confirmarLabel: "Cancelar pedido", cancelarLabel: "Voltar" }))) return;
    const response = await fetch(`/api/operacional/compras/pedidos/${pedido.id}/acao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) return toast.erro(payload.error ?? "Não foi possível alterar o pedido.");
    toast.sucesso({ enviar: `Pedido ${pedido.numero} marcado como enviado.`, cancelar: `Pedido ${pedido.numero} cancelado.`, reabrir: `Pedido ${pedido.numero} voltou para rascunho.` }[acao]);
    carregar();
  }

  async function excluirPedido(pedido: PedidoCompra) {
    if (!(await confirmar(`Excluir o pedido ${pedido.numero}?`))) return;
    const response = await fetch(`/api/operacional/compras/pedidos/${pedido.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.success) return toast.erro(payload.error ?? "Não foi possível excluir o pedido.");
    toast.sucesso("Pedido excluído.");
    carregar();
  }

  async function excluirCotacao(cotacao: Cotacao) {
    if (!(await confirmar(`Excluir a cotação ${cotacao.numero} e as propostas dela?`))) return;
    const response = await fetch(`/api/operacional/compras/cotacoes/${cotacao.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.success) return toast.erro(payload.error ?? "Não foi possível excluir a cotação.");
    toast.sucesso("Cotação excluída.");
    carregar();
  }

  async function aplicarAoCatalogo(item: HistoricoDeItemComCatalogo) {
    if (!item.catalogo) return;
    const seguir = await confirmar(
      `Atualizar "${item.catalogo.descricao}" no catálogo de preços do orçamento de ${formatarMoeda(item.catalogo.preco_unitario)} para ${formatarMoeda(item.ultimoPreco)}? Os próximos orçamentos passam a usar esse preço.`,
      { titulo: "Atualizar catálogo de preços", confirmarLabel: "Atualizar catálogo", perigo: false }
    );
    if (!seguir) return;
    const response = await fetch("/api/operacional/compras/precos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preco_config_id: item.catalogo.id, preco_unitario: item.ultimoPreco }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) return toast.erro(payload.error ?? "Não foi possível atualizar o catálogo.");
    toast.sucesso("Catálogo de preços atualizado.");
    carregar();
  }

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (pedidos ?? []).filter((p) => {
      if (filtroStatus && p.status !== filtroStatus) return false;
      if (!termo) return true;
      return [p.numero, p.fornecedor?.nome, p.servico?.numero_servico, p.servico?.cliente?.nome, ...(p.itens ?? []).map((i) => i.descricao)].some((campo) =>
        campo?.toLowerCase().includes(termo)
      );
    });
  }, [pedidos, filtroStatus, busca]);

  const historicoFiltrado = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (historico ?? []).filter((h) => !termo || h.descricao.toLowerCase().includes(termo) || h.compras.some((c) => c.fornecedor.toLowerCase().includes(termo)));
  }, [historico, busca]);

  const carregando = !erro && (!pedidos || !cotacoes || !historico);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compras</h1>
          <p className="text-sm text-gray-500">Pedidos a fornecedores, cotações comparadas e o histórico do que foi pago por item.</p>
        </div>
        {aba === "pedidos" && (
          <button type="button" className="btn-primary" onClick={() => setPedidoAberto("novo")}>
            + Novo pedido
          </button>
        )}
        {aba === "cotacoes" && (
          <button type="button" className="btn-primary" onClick={() => setCotacaoAberta("nova")}>
            + Nova cotação
          </button>
        )}
      </div>

      <TabsNavigation tabs={ABAS} activeTab={aba} onTabChange={setAba} />

      {erro && (
        <div className="card text-sm text-status-error">
          <p>{erro}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}
      {carregando && <p className="text-sm text-gray-500">Carregando...</p>}

      {/* ------------------------------------------------------------ Pedidos */}
      {aba === "pedidos" && pedidos && (
        <>
          <div className="card grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              aria-label="Buscar pedido"
              className="input-field sm:col-span-2"
              placeholder="Buscar por número, fornecedor, obra ou item..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select aria-label="Situação" className="input-field" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todas as situações</option>
              {(Object.keys(LABEL_STATUS_PEDIDO) as StatusPedidoCompra[]).map((s) => (
                <option key={s} value={s}>
                  {LABEL_STATUS_PEDIDO[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="tabela-cartoes w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2 text-left">Pedido</th>
                  <th className="px-4 py-2 text-left">Fornecedor</th>
                  <th className="px-4 py-2 text-left">Obra</th>
                  <th className="px-4 py-2 text-left">Entrega</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pedidosFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Pedido" className="px-4 py-2">
                      <span className="font-semibold text-brand">{p.numero}</span>
                      <span className="block text-xs text-gray-500">
                        {formatarData(p.data_pedido)} · {(p.itens ?? []).length} ite{(p.itens ?? []).length === 1 ? "m" : "ns"}
                      </span>
                    </td>
                    <td data-label="Fornecedor" className="px-4 py-2">
                      {p.fornecedor?.nome ?? "—"}
                    </td>
                    <td data-label="Obra" className="px-4 py-2 text-gray-600">
                      {p.servico ? `${p.servico.numero_servico}${p.servico.cliente?.nome ? ` · ${p.servico.cliente.nome}` : ""}` : "—"}
                    </td>
                    <td data-label="Entrega" className="whitespace-nowrap px-4 py-2 text-gray-600">
                      {p.data_recebimento ? `Recebido em ${formatarData(p.data_recebimento)}` : p.previsao_entrega ? `Prevista ${formatarData(p.previsao_entrega)}` : "—"}
                    </td>
                    <td data-label="Valor" className="whitespace-nowrap px-4 py-2 text-right font-medium">
                      {formatarMoeda(p.valor_total)}
                    </td>
                    <td data-label="Situação" className="px-4 py-2">
                      <span className={`badge ${CLASSE_STATUS[p.status]}`}>{LABEL_STATUS_PEDIDO[p.status]}</span>
                    </td>
                    <td data-label="Ações" className="px-4 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-semibold">
                        {p.status === "rascunho" && (
                          <button type="button" className="text-brand hover:underline" onClick={() => acaoPedido(p, "enviar")}>
                            Marcar enviado
                          </button>
                        )}
                        {(p.status === "rascunho" || p.status === "enviado") && (
                          <button type="button" className="text-accent-dark hover:underline" onClick={() => setRecebendo(p)}>
                            Receber
                          </button>
                        )}
                        {p.status === "enviado" && (
                          <button type="button" className="text-status-error hover:underline" onClick={() => acaoPedido(p, "cancelar")}>
                            Cancelar
                          </button>
                        )}
                        {p.status === "cancelado" && (
                          <button type="button" className="text-brand hover:underline" onClick={() => acaoPedido(p, "reabrir")}>
                            Reabrir
                          </button>
                        )}
                        <button type="button" className="p-1 hover:opacity-70" title="Abrir pedido" aria-label={`Abrir pedido ${p.numero}`} onClick={() => setPedidoAberto(p)}>
                          <Pencil className="icone" aria-hidden />
                        </button>
                        {(p.status === "rascunho" || p.status === "cancelado") && (
                          <button type="button" className="p-1 text-status-error hover:opacity-70" title="Excluir pedido" aria-label={`Excluir pedido ${p.numero}`} onClick={() => excluirPedido(p)}>
                            <Trash2 className="icone" aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pedidosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                      {pedidos.length === 0 ? "Nenhum pedido de compra ainda." : "Nenhum pedido com esses filtros."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ----------------------------------------------------------- Cotações */}
      {aba === "cotacoes" && cotacoes && (
        <div className="card overflow-x-auto p-0">
          <table className="tabela-cartoes w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Cotação</th>
                <th className="px-4 py-2 text-left">Obra</th>
                <th className="px-4 py-2 text-left">Itens</th>
                <th className="px-4 py-2 text-left">Propostas</th>
                <th className="px-4 py-2 text-right">Menor total</th>
                <th className="px-4 py-2 text-left">Situação</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cotacoes.map((c) => {
                const comparacao = compararCotacao(c.itens, c.propostas ?? []);
                const melhor = comparacao.propostas.find((p) => p.propostaId === comparacao.melhorPropostaId);
                return (
                  <tr key={c.id}>
                    <td data-label="Cotação" className="px-4 py-2">
                      <span className="font-semibold text-brand">{c.numero}</span>
                      <span className="block text-gray-700">{c.titulo}</span>
                    </td>
                    <td data-label="Obra" className="px-4 py-2 text-gray-600">
                      {c.servico ? c.servico.numero_servico : "—"}
                    </td>
                    <td data-label="Itens" className="px-4 py-2 text-gray-600">
                      {c.itens.length}
                    </td>
                    <td data-label="Propostas" className="px-4 py-2 text-gray-600">
                      {(c.propostas ?? []).length === 0 ? "Nenhuma" : (c.propostas ?? []).map((p) => p.fornecedor?.nome ?? "—").join(", ")}
                    </td>
                    <td data-label="Menor total" className="whitespace-nowrap px-4 py-2 text-right">
                      {melhor ? (
                        <>
                          <span className="font-medium">{formatarMoeda(melhor.total)}</span>
                          <span className="block text-xs text-gray-500">{melhor.fornecedor}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="Situação" className="px-4 py-2">
                      <span className={`badge ${c.status === "concluida" ? "bg-accent-light text-accent-dark" : "bg-secondary-light text-brand"}`}>{LABEL_STATUS_COTACAO[c.status]}</span>
                    </td>
                    <td data-label="Ações" className="px-4 py-2">
                      <div className="flex items-center justify-end gap-3">
                        <button type="button" className="p-1 hover:opacity-70" title="Abrir cotação" aria-label={`Abrir cotação ${c.numero}`} onClick={() => setCotacaoAberta(c)}>
                          <Pencil className="icone" aria-hidden />
                        </button>
                        <button type="button" className="p-1 text-status-error hover:opacity-70" title="Excluir cotação" aria-label={`Excluir cotação ${c.numero}`} onClick={() => excluirCotacao(c)}>
                          <Trash2 className="icone" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {cotacoes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Nenhuma cotação ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------ Histórico de preços */}
      {aba === "precos" && historico && (
        <>
          <div className="card">
            <input aria-label="Buscar item" className="input-field" placeholder="Buscar por item ou fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            <p className="mt-2 text-xs text-gray-500">
              Entram aqui os itens dos pedidos enviados e recebidos. Compras do mesmo item são agrupadas pela descrição e pela unidade — escreva a descrição sempre
              igual para o histórico juntar.
            </p>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-right">Último preço</th>
                  <th className="px-4 py-2 text-right">Menor</th>
                  <th className="px-4 py-2 text-right">Médio</th>
                  <th className="px-4 py-2 text-left">Catálogo do orçamento</th>
                  <th className="px-4 py-2 text-right">Compras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historicoFiltrado.map((h) => {
                  const chave = `${h.descricao}|${h.unidade}`;
                  const diferenca = h.catalogo ? h.ultimoPreco - h.catalogo.preco_unitario : 0;
                  return (
                    <Fragment key={chave}>
                      <tr>
                        <td className="px-4 py-2">
                          {h.descricao}
                          <span className="block text-xs text-gray-500">
                            por {h.unidade} · última: {h.compras[0].fornecedor}, {formatarData(h.compras[0].data)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-medium">
                          {formatarMoeda(h.ultimoPreco)}
                          {h.variacaoPercentual !== null && h.variacaoPercentual !== 0 && (
                            <span className={`block text-xs font-normal ${h.variacaoPercentual > 0 ? "text-status-error" : "text-accent-dark"}`}>
                              {h.variacaoPercentual > 0 ? "+" : ""}
                              {h.variacaoPercentual.toFixed(1)}% vs. anterior
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-gray-600">{formatarMoeda(h.menorPreco)}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-gray-600">{formatarMoeda(h.precoMedio)}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">
                          {h.catalogo ? (
                            <>
                              {h.catalogo.descricao}: {formatarMoeda(h.catalogo.preco_unitario)}
                              {h.catalogo.unidade ? `/${h.catalogo.unidade}` : ""}
                              {Math.abs(diferenca) >= 0.01 && (
                                <button type="button" className="mt-0.5 block font-semibold text-brand hover:underline" onClick={() => aplicarAoCatalogo(h)}>
                                  Atualizar para {formatarMoeda(h.ultimoPreco)}
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">Sem ligação</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            className="text-xs font-semibold text-brand hover:underline"
                            aria-expanded={itemAberto === chave}
                            onClick={() => setItemAberto((atual) => (atual === chave ? null : chave))}
                          >
                            {h.compras.length} {itemAberto === chave ? "▲" : "▼"}
                          </button>
                        </td>
                      </tr>
                      {itemAberto === chave && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-3">
                            <ul className="space-y-1 text-xs text-gray-700">
                              {h.compras.map((c, i) => (
                                <li key={i} className="flex flex-wrap justify-between gap-2">
                                  <span>
                                    {formatarData(c.data)} · {c.fornecedor} · pedido {c.pedido} · {c.quantidade} {c.unidade}
                                  </span>
                                  <span className="font-medium">{formatarMoeda(c.preco_unitario)}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {historicoFiltrado.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                      {historico.length === 0 ? "Ainda não há pedidos enviados ou recebidos para formar o histórico." : "Nenhum item com essa busca."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pedidoAberto && (
        <ModalPedidoCompra
          pedido={pedidoAberto === "novo" ? null : pedidoAberto}
          fornecedores={fornecedores}
          servicos={servicos}
          catalogo={catalogo}
          onFechar={() => setPedidoAberto(null)}
          onSalvo={() => {
            setPedidoAberto(null);
            carregar();
          }}
        />
      )}

      {recebendo && (
        <ModalReceberPedido
          pedido={recebendo}
          onFechar={() => setRecebendo(null)}
          onRecebido={() => {
            setRecebendo(null);
            carregar();
          }}
        />
      )}

      {cotacaoAberta && (
        <ModalCotacao
          cotacao={cotacaoAberta === "nova" ? null : cotacaoAberta}
          fornecedores={fornecedores}
          servicos={servicos}
          onFechar={() => setCotacaoAberta(null)}
          onMudou={(atualizada) => {
            if (atualizada) setCotacaoAberta(atualizada);
            carregar();
          }}
          onPedidoGerado={(numero) => {
            setCotacaoAberta(null);
            setAba("pedidos");
            toast.sucesso(`Pedido ${numero} criado em rascunho a partir da cotação.`);
            carregar();
          }}
        />
      )}
    </div>
  );
}
