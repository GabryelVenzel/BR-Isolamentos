"use client";

import { useState } from "react";
import { toast } from "./toast";
import type { CustoFixo } from "@/lib/types/domain";

interface Props {
  custoFixo: CustoFixo | null; // null = criar novo
  onFechar: () => void;
  onSalvo: () => void;
}

// Categoria única e travada pra todo Custo Fixo — é a mesma categoria
// padrão já cadastrada em "Categorias" (protegida, não pode ser excluída,
// só desativada), diferente do Lançamento avulso, que continua com a lista
// de categorias livre (o usuário cria quantas quiser). Pedido explícito:
// "essa é uma categoria já existente e padrão" — não faz sentido deixar o
// usuário escolher/digitar outra aqui, já que TODO custo fixo é, por
// definição, dessa categoria.
const CATEGORIA_CUSTO_FIXO = "Custo fixo";

export default function ModalCustoFixo({ custoFixo, onFechar, onSalvo }: Props) {
  const [descricao, setDescricao] = useState(custoFixo?.descricao ?? "");
  const categoria = CATEGORIA_CUSTO_FIXO;
  const [valorMensal, setValorMensal] = useState(custoFixo?.valor_mensal != null ? String(custoFixo.valor_mensal) : "");
  const [diaMes, setDiaMes] = useState(custoFixo?.dia_mes != null ? String(custoFixo.dia_mes) : "");
  const [notas, setNotas] = useState(custoFixo?.notas ?? "");
  const [ativo, setAtivo] = useState(custoFixo?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!descricao.trim()) {
      setErro("Informe a descrição do custo.");
      return;
    }
    if (!valorMensal) {
      setErro("Informe o valor mensal.");
      return;
    }
    if (!diaMes || Number(diaMes) < 1 || Number(diaMes) > 31) {
      setErro("Informe o dia do mês (1-31) para pagamento.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const payload = {
      descricao,
      categoria,
      valor_mensal: Number(valorMensal),
      dia_mes: Number(diaMes),
      notas: notas || null,
      ativo,
    };

    try {
      const response = custoFixo
        ? await fetch(`/api/financeiro/custos-fixos/${custoFixo.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/financeiro/custos-fixos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErro(data.error ?? "Erro ao salvar custo fixo.");
        return;
      }

      toast.sucesso(custoFixo ? "Custo fixo atualizado." : "Custo fixo cadastrado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">
          {custoFixo ? "Editar Custo Fixo" : "Novo Custo Fixo"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label-field">
              Descrição do custo<span className="text-status-error"> *</span>
            </label>
            <input
              className="input-field"
              placeholder="Ex: Aluguel, Internet, Salário..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">Categoria</label>
            <input className="input-field disabled:cursor-not-allowed disabled:bg-gray-50" value={categoria} disabled />
            <p className="mt-1 text-xs text-gray-400">
              Categoria fixa para custos recorrentes — as demais categorias (Lançamentos) continuam livres.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">
                Valor mensal (R$)<span className="text-status-error"> *</span>
              </label>
              <input type="number" step="0.01" className="input-field" value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} />
            </div>
            <div>
              <label className="label-field">
                Dia do mês<span className="text-status-error"> *</span>
              </label>
              <input type="number" min={1} max={31} className="input-field" value={diaMes} onChange={(e) => setDiaMes(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label-field">Notas</label>
            <textarea className="input-field" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
