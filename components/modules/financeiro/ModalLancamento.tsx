"use client";

import { useEffect, useState } from "react";
import { toast } from "./toast";
import AnexosUpload from "./AnexosUpload";
import type { AnexoLancamento, CategoriaLancamento, LancamentoFinanceiro, TipoLancamentoFinanceiro } from "@/lib/types/domain";

interface Props {
  lancamento: LancamentoFinanceiro | null; // null = criar novo
  onFechar: () => void;
  onSalvo: () => void;
}

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export default function ModalLancamento({ lancamento, onFechar, onSalvo }: Props) {
  const [tipo, setTipo] = useState<TipoLancamentoFinanceiro>(lancamento?.tipo ?? "despesa");
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([]);
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? "");
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor] = useState(lancamento?.valor != null ? String(lancamento.valor) : "");
  const [data, setData] = useState(lancamento?.data ?? hojeISO());
  const [pago, setPago] = useState(lancamento?.pago ?? false);
  const [dataPagamento, setDataPagamento] = useState(lancamento?.data_pagamento ?? hojeISO());
  const [anexos, setAnexos] = useState<AnexoLancamento[]>(lancamento?.anexos ?? []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/financeiro/categorias?tipo=${tipo}&ativo=true`)
      .then((r) => r.json())
      .then((p) => p.success && setCategorias(p.data));
  }, [tipo]);

  // Trocar o tipo sem categoria ainda selecionada (fluxo de criação) limpa a
  // categoria — evita mandar uma categoria de receita presa a um lançamento
  // de despesa por engano.
  function trocarTipo(novoTipo: TipoLancamentoFinanceiro) {
    setTipo(novoTipo);
    if (!lancamento) setCategoria("");
  }

  async function salvar() {
    if (!categoria) {
      setErro("Selecione a categoria.");
      return;
    }
    if (!descricao.trim()) {
      setErro("Descreva o lançamento.");
      return;
    }
    if (!valor) {
      setErro("Informe o valor.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const payload = {
      tipo,
      categoria,
      descricao,
      valor: Number(valor),
      data,
      pago,
      data_pagamento: pago ? dataPagamento : null,
      anexos,
    };

    try {
      const response = lancamento
        ? await fetch(`/api/financeiro/lancamentos/${lancamento.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/financeiro/lancamentos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data_ = await response.json();
      if (!response.ok || !data_.success) {
        setErro(data_.error ?? "Erro ao salvar lançamento.");
        return;
      }

      toast.sucesso(lancamento ? "Lançamento atualizado." : "Lançamento criado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">
          {lancamento ? "Editar Lançamento" : "Novo Lançamento"}
        </h2>

        <div className="space-y-4">
          <div>
            <p className="label-field">
              Tipo<span className="text-status-error"> *</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" className={tipo === "receita" ? "btn-accent" : "btn-secondary"} onClick={() => trocarTipo("receita")}>
                Receita
              </button>
              <button type="button" className={tipo === "despesa" ? "btn-danger" : "btn-secondary"} onClick={() => trocarTipo("despesa")}>
                Despesa
              </button>
            </div>
          </div>

          <div>
            <label className="label-field">
              Categoria<span className="text-status-error"> *</span>
            </label>
            <select className="input-field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Selecione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field">Descrição</label>
            <input
              className="input-field"
              placeholder='Ex: "Orçamento cliente X", "Pagamento aluguel"...'
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">
                Valor (R$)<span className="text-status-error"> *</span>
              </label>
              <input type="number" step="0.01" className="input-field" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div>
              <label className="label-field">
                Data<span className="text-status-error"> *</span>
              </label>
              <input type="date" className="input-field" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
            Já pago/recebido
          </label>

          {pago && (
            <div>
              <label className="label-field">Data de pagamento</label>
              <input type="date" className="input-field" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>
          )}

          <AnexosUpload anexos={anexos} onChange={setAnexos} />

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : lancamento ? "Salvar alterações" : "Criar lançamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
