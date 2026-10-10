"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import { confirmar } from "@/components/ui/confirmar";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { compararCotacao } from "@/lib/compras";
import { formatarMoeda } from "@/lib/format";
import type { Cotacao, CotacaoProposta, Fornecedor, Servico } from "@/lib/types/domain";
import { toast } from "../toast";
import EditorItens, { itemVazio, type ItemEditavel } from "./EditorItens";

interface Props {
  cotacao: Cotacao | null; // null = nova
  fornecedores: Fornecedor[];
  servicos: Servico[];
  onFechar: () => void;
  /** Recarrega a lista; recebe a cotação atualizada para o modal continuar aberto nela. */
  onMudou: (cotacao: Cotacao | null) => void;
  /** Pedido gerado a partir de uma proposta. */
  onPedidoGerado: (numero: string) => void;
}

/** Preços em edição: propostaId → itemId → texto decimal. */
type PrecosEmEdicao = Record<string, Record<string, string>>;

function precosIniciais(propostas: CotacaoProposta[]): PrecosEmEdicao {
  return Object.fromEntries(propostas.map((p) => [p.id, Object.fromEntries(Object.entries(p.precos ?? {}).map(([itemId, v]) => [itemId, v ? String(v) : ""]))]));
}

export default function ModalCotacao({ cotacao, fornecedores, servicos, onFechar, onMudou, onPedidoGerado }: Props) {
  const [titulo, setTitulo] = useState(cotacao?.titulo ?? "");
  const [servicoId, setServicoId] = useState(cotacao?.servico_id ?? "");
  const [observacoes, setObservacoes] = useState(cotacao?.observacoes ?? "");
  const [itens, setItens] = useState<ItemEditavel[]>(
    cotacao?.itens?.length
      ? cotacao.itens.map((i) => ({ chave: i.id, descricao: i.descricao, unidade: i.unidade, quantidade: String(i.quantidade), preco: "", preco_config_id: null }))
      : [itemVazio()]
  );
  const [precos, setPrecos] = useState<PrecosEmEdicao>(precosIniciais(cotacao?.propostas ?? []));
  const [novoFornecedor, setNovoFornecedor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const propostas = useMemo(() => cotacao?.propostas ?? [], [cotacao]);
  const concluida = cotacao?.status === "concluida";

  // Comparação calculada com os preços que estão na tela (mesmo antes de salvar).
  const comparacao = useMemo(() => {
    if (!cotacao) return null;
    const comPrecosDaTela = propostas.map((p) => ({
      ...p,
      precos: Object.fromEntries(Object.entries(precos[p.id] ?? {}).map(([itemId, texto]) => [itemId, Number(texto) || 0])),
    }));
    return compararCotacao(cotacao.itens, comPrecosDaTela);
  }, [cotacao, propostas, precos]);

  const fornecedoresDisponiveis = fornecedores.filter((f) => !propostas.some((p) => p.fornecedor_id === f.id));

  async function chamar(url: string, metodo: string, corpo?: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    try {
      const response = await fetch(url, {
        method: metodo,
        headers: corpo ? { "Content-Type": "application/json" } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const payload = await response.json();
      return { ok: response.ok && payload.success, data: payload.data, error: payload.error };
    } catch {
      return { ok: false, error: "Erro de conexão. Tente novamente." };
    }
  }

  async function salvarCotacao() {
    const preenchidos = itens.filter((i) => i.descricao.trim());
    if (!titulo.trim()) return setErro("Dê um título à cotação.");
    if (preenchidos.length === 0) return setErro("Inclua pelo menos um item.");
    if (preenchidos.some((i) => !(Number(i.quantidade) > 0))) return setErro("Toda quantidade precisa ser maior que zero.");
    setErro(null);
    setSalvando(true);

    const resultado = await chamar(cotacao ? `/api/operacional/compras/cotacoes/${cotacao.id}` : "/api/operacional/compras/cotacoes", cotacao ? "PATCH" : "POST", {
      titulo: titulo.trim(),
      servico_id: servicoId || null,
      observacoes: observacoes.trim() || null,
      itens: preenchidos.map((i) => ({ id: i.chave, descricao: i.descricao.trim(), unidade: i.unidade, quantidade: Number(i.quantidade) })),
    });
    setSalvando(false);
    if (!resultado.ok) return setErro(resultado.error ?? "Não foi possível salvar a cotação.");

    toast.sucesso(cotacao ? "Cotação atualizada." : "Cotação criada — agora adicione os fornecedores e os preços.");
    onMudou(resultado.data as Cotacao);
  }

  async function adicionarFornecedor() {
    if (!cotacao || !novoFornecedor) return;
    const resultado = await chamar(`/api/operacional/compras/cotacoes/${cotacao.id}/propostas`, "PUT", { fornecedor_id: novoFornecedor, precos: {} });
    if (!resultado.ok) return toast.erro(resultado.error ?? "Não foi possível adicionar o fornecedor.");
    setNovoFornecedor("");
    onMudou(resultado.data as Cotacao);
  }

  async function salvarPrecos(): Promise<Cotacao | null> {
    if (!cotacao) return null;
    let atualizada: Cotacao | null = null;
    for (const proposta of propostas) {
      const resultado = await chamar(`/api/operacional/compras/cotacoes/${cotacao.id}/propostas`, "PUT", {
        fornecedor_id: proposta.fornecedor_id,
        precos: Object.fromEntries(Object.entries(precos[proposta.id] ?? {}).filter(([, texto]) => Number(texto) > 0).map(([itemId, texto]) => [itemId, Number(texto)])),
        prazo_entrega_dias: proposta.prazo_entrega_dias,
        condicao_pagamento: proposta.condicao_pagamento,
        observacoes: proposta.observacoes,
      });
      if (!resultado.ok) {
        toast.erro(resultado.error ?? "Não foi possível salvar os preços.");
        return null;
      }
      atualizada = resultado.data as Cotacao;
    }
    return atualizada;
  }

  async function salvarPrecosEAvisar() {
    setSalvando(true);
    const atualizada = await salvarPrecos();
    setSalvando(false);
    if (atualizada) {
      toast.sucesso("Preços salvos.");
      onMudou(atualizada);
    }
  }

  async function removerProposta(proposta: CotacaoProposta) {
    if (!cotacao) return;
    if (!(await confirmar(`Remover a proposta de "${proposta.fornecedor?.nome ?? "fornecedor"}" desta cotação?`))) return;
    const resultado = await chamar(`/api/operacional/compras/cotacoes/${cotacao.id}/propostas?proposta=${proposta.id}`, "DELETE");
    if (!resultado.ok) return toast.erro(resultado.error ?? "Não foi possível remover a proposta.");
    onMudou(resultado.data as Cotacao);
  }

  async function gerarPedido(proposta: CotacaoProposta) {
    if (!cotacao) return;
    const comparada = comparacao?.propostas.find((p) => p.propostaId === proposta.id);
    const aviso = comparada && !comparada.completa ? ` ${comparada.itensSemPreco} item(ns) sem preço entram no pedido com valor zero.` : "";
    const seguir = await confirmar(`Gerar um pedido de compra em rascunho para "${proposta.fornecedor?.nome ?? "fornecedor"}" com os preços desta proposta?${aviso}`, {
      titulo: "Gerar pedido de compra",
      confirmarLabel: "Gerar pedido",
      perigo: false,
    });
    if (!seguir) return;

    setSalvando(true);
    // Garante que o pedido saia com os preços que estão na tela.
    const salva = await salvarPrecos();
    if (!salva) return setSalvando(false);
    const resultado = await chamar(`/api/operacional/compras/cotacoes/${cotacao.id}/gerar-pedido`, "POST", { proposta_id: proposta.id });
    setSalvando(false);
    if (!resultado.ok) return toast.erro(resultado.error ?? "Não foi possível gerar o pedido.");
    onPedidoGerado((resultado.data as { numero: string }).numero);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-modal-cotacao" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-card bg-white p-6 shadow-card-hover">
        <h2 id="titulo-modal-cotacao" className="mb-4 font-montserrat text-lg font-bold text-brand">
          {cotacao ? `Cotação ${cotacao.numero}` : "Nova cotação"}
          {concluida && <span className="badge ml-2 bg-accent-light align-middle text-accent-dark">Concluída</span>}
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="cotacao-titulo">
                Título<span className="text-status-error"> *</span>
              </label>
              <input id="cotacao-titulo" className="input-field" placeholder='Ex.: "Chaparia — obra Opella"' value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <label className="label-field" htmlFor="cotacao-obra">
                Obra de destino
              </label>
              <select id="cotacao-obra" className="input-field" value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
                <option value="">Nenhuma</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.numero_servico}
                    {s.cliente?.nome ? ` — ${s.cliente.nome}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="label-field">
              Itens a cotar<span className="text-status-error"> *</span>
            </p>
            <EditorItens itens={itens} onChange={setItens} comPreco={false} servicoId={servicoId} />
          </div>

          <div>
            <label className="label-field" htmlFor="cotacao-obs">
              Observações
            </label>
            <textarea id="cotacao-obs" className="input-field" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-status-error">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Fechar
            </button>
            <button type="button" className="btn-primary" onClick={salvarCotacao} disabled={salvando}>
              {salvando ? "Salvando..." : cotacao ? "Salvar itens" : "Criar cotação"}
            </button>
          </div>

          {cotacao && comparacao && (
            <div className="space-y-3 border-t border-gray-200 pt-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-montserrat text-sm font-bold uppercase text-brand">Propostas dos fornecedores</h3>
                  <p className="text-xs text-gray-500">Preço unitário por item. O menor de cada linha fica destacado; o menor total entre quem cotou tudo, também.</p>
                </div>
                <div className="flex gap-2">
                  <select aria-label="Fornecedor a adicionar" className="input-field py-1.5 text-sm" value={novoFornecedor} onChange={(e) => setNovoFornecedor(e.target.value)}>
                    <option value="">Adicionar fornecedor...</option>
                    {fornecedoresDisponiveis.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={adicionarFornecedor} disabled={!novoFornecedor}>
                    Adicionar
                  </button>
                </div>
              </div>

              {propostas.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum fornecedor nesta cotação ainda.</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-card border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="table-header">
                          <th className="px-3 py-2 text-left">Item</th>
                          {propostas.map((p) => (
                            <th key={p.id} className="min-w-[9.5rem] px-3 py-2 text-right">
                              <span className="flex items-center justify-end gap-1">
                                {p.fornecedor?.nome ?? "Fornecedor"}
                                <button type="button" className="p-0.5 text-status-error hover:opacity-70" title="Remover proposta" aria-label={`Remover proposta de ${p.fornecedor?.nome ?? "fornecedor"}`} onClick={() => removerProposta(p)}>
                                  <Trash2 className="icone" aria-hidden />
                                </button>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cotacao.itens.map((item) => (
                          <tr key={item.id}>
                            <th scope="row" className="px-3 py-2 text-left font-normal">
                              {item.descricao}
                              <span className="block text-xs text-gray-500">
                                {item.quantidade} {item.unidade}
                              </span>
                            </th>
                            {propostas.map((p) => {
                              const menor = comparacao.menorPrecoPorItem[item.id] === p.id && propostas.length > 1;
                              return (
                                <td key={p.id} className={`px-3 py-2 ${menor ? "bg-accent-light/60" : ""}`}>
                                  <CampoMoeda
                                    value={precos[p.id]?.[item.id] ?? ""}
                                    onChange={(v) => setPrecos((atual) => ({ ...atual, [p.id]: { ...(atual[p.id] ?? {}), [item.id]: v } }))}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <th scope="row" className="px-3 py-2 text-left">
                            Total
                          </th>
                          {comparacao.propostas.map((p) => (
                            <td key={p.propostaId} className={`px-3 py-2 text-right ${comparacao.melhorPropostaId === p.propostaId ? "text-accent-dark" : "text-brand"}`}>
                              {formatarMoeda(p.total)}
                              {comparacao.melhorPropostaId === p.propostaId && <span className="block text-xs font-normal">menor total</span>}
                              {!p.completa && <span className="block text-xs font-normal text-gray-500">{p.itensSemPreco} sem preço</span>}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="px-3 py-2" />
                          {propostas.map((p) => (
                            <td key={p.id} className="px-3 py-2 text-right">
                              <button type="button" className="btn-accent px-3 py-1.5 text-xs" onClick={() => gerarPedido(p)} disabled={salvando}>
                                Gerar pedido
                              </button>
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" className="btn-primary" onClick={salvarPrecosEAvisar} disabled={salvando}>
                      {salvando ? "Salvando..." : "Salvar preços"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
