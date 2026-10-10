"use client";

import { useEffect, useState } from "react";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { FORMAS_PAGAMENTO, LABEL_FORMA_PAGAMENTO, hojeBrasilia } from "@/lib/financeiro";
import { formatarMoeda } from "@/lib/format";
import type { CategoriaLancamento, FormaPagamento, PedidoCompra } from "@/lib/types/domain";
import { toast } from "../toast";

interface Props {
  pedido: PedidoCompra;
  onFechar: () => void;
  onRecebido: () => void;
}

/** Recebimento de um pedido: confirma a data e gera a conta a pagar ligada
 * ao fornecedor e à obra do pedido. */
export default function ModalReceberPedido({ pedido, onFechar, onRecebido }: Props) {
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([]);
  const [dataRecebimento, setDataRecebimento] = useState(hojeBrasilia());
  const [gerarConta, setGerarConta] = useState(pedido.valor_total > 0);
  const [categoria, setCategoria] = useState("");
  const [vencimento, setVencimento] = useState(hojeBrasilia());
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [parcelas, setParcelas] = useState("1");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // As categorias vêm da rota da obra (aberta ao Operacional) quando o pedido
  // tem obra; senão, da rota do Financeiro — que pode recusar quem não tem o módulo.
  useEffect(() => {
    const url = pedido.servico_id ? `/api/operacional/servicos/${pedido.servico_id}/lancamentos` : "/api/financeiro/categorias?tipo=despesa&ativo=true";
    fetch(url)
      .then((r) => r.json())
      .then((p) => {
        if (!p.success) return;
        setCategorias(pedido.servico_id ? p.data.categoriasDespesa : p.data);
      })
      .catch(() => undefined);
  }, [pedido.servico_id]);

  async function receber() {
    const n = Number(parcelas);
    if (gerarConta) {
      if (!categoria) return setErro("Selecione a categoria da despesa.");
      if (!vencimento) return setErro("Informe o vencimento.");
      if (!Number.isInteger(n) || n < 1 || n > 60) return setErro("Parcelas: informe de 1 a 60.");
    }
    setErro(null);
    setSalvando(true);
    try {
      const response = await fetch(`/api/operacional/compras/pedidos/${pedido.id}/receber`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_recebimento: dataRecebimento,
          categoria: gerarConta ? categoria : "—",
          vencimento: gerarConta ? vencimento : dataRecebimento,
          forma_pagamento: forma || null,
          parcelas: gerarConta ? n : 1,
          sem_lancamento: !gerarConta,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível receber o pedido.");
        return;
      }
      toast.sucesso(gerarConta ? `Pedido ${pedido.numero} recebido — conta a pagar gerada.` : `Pedido ${pedido.numero} recebido.`);
      onRecebido();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-receber" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-card-hover">
        <h2 id="titulo-receber" className="mb-1 font-montserrat text-lg font-bold text-brand">
          Receber pedido {pedido.numero}
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          {pedido.fornecedor?.nome ?? "Fornecedor"} · {formatarMoeda(pedido.valor_total)}
          {pedido.servico ? ` · obra ${pedido.servico.numero_servico}` : ""}
        </p>

        <div className="space-y-4">
          <div className="sm:max-w-[14rem]">
            <label className="label-field" htmlFor="receber-data">
              Data do recebimento
            </label>
            <input id="receber-data" type="date" className="input-field" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={gerarConta} onChange={(e) => setGerarConta(e.target.checked)} />
            <span>
              Gerar a conta a pagar
              <span className="block text-xs text-gray-500">
                Despesa de {formatarMoeda(pedido.valor_total)} ligada ao fornecedor{pedido.servico ? " e à obra" : ""}. Desmarque se ela já foi lançada à mão.
              </span>
            </span>
          </label>

          {gerarConta && (
            <div className="grid grid-cols-1 gap-4 rounded-card border border-gray-200 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label-field" htmlFor="receber-categoria">
                  Categoria da despesa<span className="text-status-error"> *</span>
                </label>
                <select id="receber-categoria" className="input-field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option value="">Selecione...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.nome}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                {categorias.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Sem categorias disponíveis para o seu acesso. Peça a quem tem o módulo Financeiro para receber este pedido, ou desmarque a conta a pagar.
                  </p>
                )}
              </div>
              <div>
                <label className="label-field" htmlFor="receber-vencimento">
                  Vencimento{Number(parcelas) > 1 ? " da 1ª parcela" : ""}
                  <span className="text-status-error"> *</span>
                </label>
                <input id="receber-vencimento" type="date" className="input-field" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
              </div>
              <div>
                <label className="label-field" htmlFor="receber-parcelas">
                  Parcelas
                </label>
                <input id="receber-parcelas" type="number" min={1} max={60} className="input-field" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field" htmlFor="receber-forma">
                  Forma de pagamento
                </label>
                <select id="receber-forma" className="input-field" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento | "")}>
                  <option value="">Não informada</option>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {LABEL_FORMA_PAGAMENTO[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {erro && (
            <p role="alert" className="text-sm text-status-error">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-accent" onClick={receber} disabled={salvando}>
              {salvando ? "Salvando..." : "Confirmar recebimento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
