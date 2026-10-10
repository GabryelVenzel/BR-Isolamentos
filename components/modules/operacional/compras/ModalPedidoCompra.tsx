"use client";

import { useState } from "react";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { LABEL_STATUS_PEDIDO } from "@/lib/compras";
import { hojeBrasilia } from "@/lib/financeiro";
import type { Fornecedor, PedidoCompra, Servico } from "@/lib/types/domain";
import { toast } from "../toast";
import EditorItens, { itemVazio, novaChave, type ItemDoCatalogo, type ItemEditavel } from "./EditorItens";

interface Props {
  pedido: PedidoCompra | null; // null = novo
  fornecedores: Fornecedor[];
  servicos: Servico[];
  catalogo: ItemDoCatalogo[];
  onFechar: () => void;
  onSalvo: () => void;
}

export default function ModalPedidoCompra({ pedido, fornecedores, servicos, catalogo, onFechar, onSalvo }: Props) {
  const [fornecedorId, setFornecedorId] = useState(pedido?.fornecedor_id ?? "");
  const [servicoId, setServicoId] = useState(pedido?.servico_id ?? "");
  const [dataPedido, setDataPedido] = useState(pedido?.data_pedido ?? hojeBrasilia());
  const [previsao, setPrevisao] = useState(pedido?.previsao_entrega ?? "");
  const [observacoes, setObservacoes] = useState(pedido?.observacoes ?? "");
  const [itens, setItens] = useState<ItemEditavel[]>(
    pedido?.itens?.length
      ? pedido.itens.map((i) => ({
          chave: novaChave(),
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: String(i.quantidade),
          preco: i.preco_unitario ? String(i.preco_unitario) : "",
          preco_config_id: i.preco_config_id,
        }))
      : [itemVazio()]
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Recebido ou cancelado: só consulta.
  const somenteLeitura = pedido?.status === "recebido" || pedido?.status === "cancelado";

  async function salvar() {
    const preenchidos = itens.filter((i) => i.descricao.trim());
    if (!fornecedorId) return setErro("Selecione o fornecedor.");
    if (preenchidos.length === 0) return setErro("Inclua pelo menos um item.");
    if (preenchidos.some((i) => !(Number(i.quantidade) > 0))) return setErro("Toda quantidade precisa ser maior que zero.");
    setErro(null);
    setSalvando(true);

    const corpo = {
      fornecedor_id: fornecedorId,
      servico_id: servicoId || null,
      cotacao_id: pedido?.cotacao_id ?? null,
      data_pedido: dataPedido,
      previsao_entrega: previsao || null,
      observacoes: observacoes.trim() || null,
      itens: preenchidos.map((i) => ({
        descricao: i.descricao.trim(),
        unidade: i.unidade,
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco) || 0,
        preco_config_id: i.preco_config_id,
      })),
    };

    try {
      const response = await fetch(pedido ? `/api/operacional/compras/pedidos/${pedido.id}` : "/api/operacional/compras/pedidos", {
        method: pedido ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível salvar o pedido.");
        return;
      }
      toast.sucesso(pedido ? "Pedido atualizado." : `Pedido ${payload.data.numero} criado como rascunho.`);
      onSalvo();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-pedido"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
      >
        <h2 id="titulo-modal-pedido" className="mb-1 font-montserrat text-lg font-bold text-brand">
          {pedido ? `Pedido ${pedido.numero}` : "Novo pedido de compra"}
        </h2>
        {pedido && (
          <p className="mb-4 text-sm text-gray-500">
            Situação: {LABEL_STATUS_PEDIDO[pedido.status]}
            {somenteLeitura && " — não pode mais ser alterado."}
          </p>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="pedido-fornecedor">
                Fornecedor<span className="text-status-error"> *</span>
              </label>
              <select id="pedido-fornecedor" className="input-field" value={fornecedorId} disabled={somenteLeitura} onChange={(e) => setFornecedorId(e.target.value)}>
                <option value="">Selecione...</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="pedido-obra">
                Obra de destino
              </label>
              <select id="pedido-obra" className="input-field" value={servicoId} disabled={somenteLeitura} onChange={(e) => setServicoId(e.target.value)}>
                <option value="">Nenhuma (estoque/uso geral)</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.numero_servico}
                    {s.cliente?.nome ? ` — ${s.cliente.nome}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="pedido-data">
                Data do pedido
              </label>
              <input id="pedido-data" type="date" className="input-field" value={dataPedido} disabled={somenteLeitura} onChange={(e) => setDataPedido(e.target.value)} />
            </div>
            <div>
              <label className="label-field" htmlFor="pedido-previsao">
                Previsão de entrega
              </label>
              <input id="pedido-previsao" type="date" className="input-field" value={previsao} disabled={somenteLeitura} onChange={(e) => setPrevisao(e.target.value)} />
            </div>
          </div>

          <div>
            <p className="label-field">
              Itens<span className="text-status-error"> *</span>
            </p>
            <EditorItens itens={itens} onChange={setItens} comPreco servicoId={somenteLeitura ? "" : servicoId} catalogo={catalogo} somenteLeitura={somenteLeitura} />
          </div>

          <div>
            <label className="label-field" htmlFor="pedido-obs">
              Observações
            </label>
            <textarea id="pedido-obs" className="input-field" rows={2} value={observacoes} disabled={somenteLeitura} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-status-error">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              {somenteLeitura ? "Fechar" : "Cancelar"}
            </button>
            {!somenteLeitura && (
              <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : pedido ? "Salvar alterações" : "Criar pedido"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
