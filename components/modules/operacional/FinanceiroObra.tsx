"use client";

import { useCallback, useEffect, useState } from "react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import type { FinanceiroDoServico } from "@/lib/contexts/financeiro-obra";
import { FORMAS_PAGAMENTO, LABEL_FORMA_PAGAMENTO, hojeBrasilia, labelSituacao, situacaoLancamento } from "@/lib/financeiro";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { FormaPagamento, Fornecedor, Parceiro } from "@/lib/types/domain";
import { toast } from "./toast";

interface Props {
  servicoId: string;
}

const FORM_INICIAL = { categoria: "", descricao: "", valor: "", vencimento: "", forma: "" as FormaPagamento | "", fornecedorId: "", parceiroId: "", pago: false };

/** Aba "Financeiro" do detalhe de um serviço: o resultado da obra (orçado,
 * receita, despesa, margem), os lançamentos ligados a ela e o formulário
 * "Registrar despesa" — o caminho de quem cuida da obra para lançar um gasto
 * já amarrado a ela, sem precisar do módulo Financeiro. */
export default function FinanceiroObra({ servicoId }: Props) {
  const [dados, setDados] = useState<FinanceiroDoServico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ ...FORM_INICIAL, vencimento: hojeBrasilia() });
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/lancamentos`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível carregar o financeiro da obra.");
        return;
      }
      setDados(payload.data);
    } catch {
      setErro("Erro de conexão ao carregar o financeiro da obra.");
    }
  }, [servicoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const lista = (url: string, set: (itens: never[]) => void) =>
      fetch(url)
        .then((r) => r.json())
        .then((p) => p.success && set(p.data))
        .catch(() => undefined);
    lista("/api/operacional/fornecedores", setFornecedores as (itens: never[]) => void);
    lista("/api/operacional/parceiros", setParceiros as (itens: never[]) => void);
  }, []);

  async function registrar() {
    if (!form.categoria) return setErroForm("Selecione a categoria.");
    if (!form.descricao.trim()) return setErroForm("Descreva a despesa.");
    if (!form.valor || Number(form.valor) <= 0) return setErroForm("Informe o valor.");
    if (!form.vencimento) return setErroForm("Informe o vencimento.");
    setErroForm(null);
    setSalvando(true);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/lancamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: form.categoria,
          descricao: form.descricao,
          valor: Number(form.valor),
          data: form.vencimento,
          forma_pagamento: form.forma || null,
          fornecedor_id: form.fornecedorId || null,
          parceiro_id: form.parceiroId || null,
          pago: form.pago,
          data_pagamento: form.pago ? hojeBrasilia() : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErroForm(payload.error ?? "Não foi possível registrar a despesa.");
        return;
      }
      toast.sucesso("Despesa registrada na obra.");
      setForm({ ...FORM_INICIAL, vencimento: hojeBrasilia() });
      setMostrarForm(false);
      carregar();
    } catch {
      setErroForm("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  if (erro) {
    return (
      <div className="text-sm text-status-error">
        <p>{erro}</p>
        <button type="button" className="btn-secondary mt-3" onClick={carregar}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!dados) return <p className="text-sm text-gray-500">Carregando...</p>;

  const { resultado, lancamentos, categoriasDespesa } = dados;
  const hoje = hojeBrasilia();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-gray-200 p-3">
          <p className="text-xs uppercase text-gray-500">Orçado</p>
          <p className="font-montserrat text-lg font-bold text-brand">{formatarMoeda(resultado.orcado)}</p>
        </div>
        <div className="rounded-card border border-gray-200 p-3">
          <p className="text-xs uppercase text-gray-500">Receita lançada</p>
          <p className="font-montserrat text-lg font-bold text-accent">{formatarMoeda(resultado.receita)}</p>
          <p className="text-xs text-gray-500">Recebido: {formatarMoeda(resultado.recebido)}</p>
        </div>
        <div className="rounded-card border border-gray-200 p-3">
          <p className="text-xs uppercase text-gray-500">Despesa lançada</p>
          <p className="font-montserrat text-lg font-bold text-status-error">{formatarMoeda(resultado.despesa)}</p>
          <p className="text-xs text-gray-500">
            Pago: {formatarMoeda(resultado.pago)}
            {resultado.consumoDoOrcadoPercentual !== null && ` · ${resultado.consumoDoOrcadoPercentual.toFixed(0)}% do orçado`}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 p-3">
          <p className="text-xs uppercase text-gray-500">Margem</p>
          <p className={`font-montserrat text-lg font-bold ${resultado.margem >= 0 ? "text-brand" : "text-status-error"}`}>{formatarMoeda(resultado.margem)}</p>
          <p className="text-xs text-gray-500">
            {resultado.margemPercentual !== null ? `${resultado.margemPercentual.toFixed(1)}% da receita` : "Sem receita lançada ainda"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-montserrat text-xs font-bold uppercase text-brand">Lançamentos da obra ({lancamentos.length})</h3>
        <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? "Fechar" : "+ Registrar despesa"}
        </button>
      </div>

      {mostrarForm && (
        <div className="space-y-3 rounded-card border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="obra-categoria">
                Categoria<span className="text-status-error"> *</span>
              </label>
              <select id="obra-categoria" className="input-field" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
                <option value="">Selecione...</option>
                {categoriasDespesa.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="obra-valor">
                Valor<span className="text-status-error"> *</span>
              </label>
              <CampoMoeda id="obra-valor" value={form.valor} onChange={(v) => setForm((f) => ({ ...f, valor: v }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field" htmlFor="obra-descricao">
                Descrição<span className="text-status-error"> *</span>
              </label>
              <input
                id="obra-descricao"
                className="input-field"
                placeholder='Ex.: "Combustível", "Diária — funileiro"...'
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field" htmlFor="obra-vencimento">
                Vencimento<span className="text-status-error"> *</span>
              </label>
              <input id="obra-vencimento" type="date" className="input-field" value={form.vencimento} onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))} />
            </div>
            <div>
              <label className="label-field" htmlFor="obra-forma">
                Forma de pagamento
              </label>
              <select id="obra-forma" className="input-field" value={form.forma} onChange={(e) => setForm((f) => ({ ...f, forma: e.target.value as FormaPagamento | "" }))}>
                <option value="">Não informada</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {LABEL_FORMA_PAGAMENTO[f]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="obra-fornecedor">
                Fornecedor
              </label>
              <select id="obra-fornecedor" className="input-field" value={form.fornecedorId} onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}>
                <option value="">Nenhum</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="obra-parceiro">
                Parceiro (mão de obra)
              </label>
              <select id="obra-parceiro" className="input-field" value={form.parceiroId} onChange={(e) => setForm((f) => ({ ...f, parceiroId: e.target.value }))}>
                <option value="">Nenhum</option>
                {parceiros.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.pago} onChange={(e) => setForm((f) => ({ ...f, pago: e.target.checked }))} />
            Já foi paga
          </label>
          {erroForm && (
            <p role="alert" className="text-sm text-status-error">
              {erroForm}
            </p>
          )}
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={registrar} disabled={salvando}>
              {salvando ? "Salvando..." : "Registrar despesa"}
            </button>
          </div>
        </div>
      )}

      {lancamentos.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum lançamento ligado a esta obra ainda.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {lancamentos.map((l) => {
            const situacao = situacaoLancamento(l, hoje);
            const detalhe = [l.categoria, l.fornecedor?.nome, l.parceiro?.nome, l.forma_pagamento && LABEL_FORMA_PAGAMENTO[l.forma_pagamento]].filter(Boolean);
            return (
              <li key={l.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate">{l.descricao}</p>
                  <p className="text-xs text-gray-500">
                    {formatarData(l.data)} · {detalhe.join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-medium ${l.tipo === "receita" ? "text-accent" : "text-status-error"}`}>
                    {l.tipo === "despesa" && "- "}
                    {formatarMoeda(l.valor)}
                  </p>
                  <p className={`text-xs ${situacao === "vencido" ? "font-semibold text-status-error" : "text-gray-500"}`}>{labelSituacao(situacao, l.tipo)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
