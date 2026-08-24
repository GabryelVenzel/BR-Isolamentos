"use client";

import { useState } from "react";
import { toast } from "./toast";
import type { CategoriaLancamento, TipoLancamentoFinanceiro } from "@/lib/types/domain";

interface Props {
  categoria: CategoriaLancamento | null; // null = criar nova
  onFechar: () => void;
  onSalvo: () => void;
}

const CORES = [
  { valor: "verde", label: "Verde", classe: "bg-accent" },
  { valor: "vermelho", label: "Vermelho", classe: "bg-status-error" },
  { valor: "azul", label: "Azul", classe: "bg-brand" },
  { valor: "amarelo", label: "Amarelo", classe: "bg-secondary" },
];

export default function ModalCategoria({ categoria, onFechar, onSalvo }: Props) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [descricao, setDescricao] = useState(categoria?.descricao ?? "");
  const [tipo, setTipo] = useState<TipoLancamentoFinanceiro>(categoria?.tipo ?? "despesa");
  const [cor, setCor] = useState(categoria?.cor ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const protegida = categoria?.protegida ?? false;

  async function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome da categoria.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const payload = { nome, descricao: descricao || null, tipo, cor: cor || null };

    try {
      const response = categoria
        ? await fetch(`/api/financeiro/categorias/${categoria.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/financeiro/categorias", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErro(data.error ?? "Erro ao salvar categoria.");
        return;
      }

      toast.sucesso(categoria ? "Categoria atualizada." : "Categoria cadastrada.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">
          {categoria ? "Editar Categoria" : "Nova Categoria"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label-field">
              Nome da categoria<span className="text-status-error"> *</span>
            </label>
            <input
              className="input-field disabled:cursor-not-allowed disabled:bg-gray-50"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={protegida}
              title={protegida ? "Categorias pré-definidas não podem ser renomeadas." : undefined}
            />
            {protegida && <p className="mt-1 text-xs text-gray-400">Categoria pré-definida — nome fixo, só pode ser desativada.</p>}
          </div>
          <div>
            <label className="label-field">Descrição</label>
            <input className="input-field" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <p className="label-field">
              Tipo<span className="text-status-error"> *</span>
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={tipo === "receita"} onChange={() => setTipo("receita")} disabled={protegida} />
                Receita
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={tipo === "despesa"} onChange={() => setTipo("despesa")} disabled={protegida} />
                Despesa
              </label>
            </div>
          </div>
          <div>
            <p className="label-field">Cor (opcional)</p>
            <div className="flex gap-2">
              {CORES.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  title={c.label}
                  onClick={() => setCor(cor === c.valor ? "" : c.valor)}
                  className={`h-8 w-8 rounded-full ${c.classe} ${cor === c.valor ? "ring-2 ring-offset-2 ring-brand" : ""}`}
                />
              ))}
            </div>
          </div>

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
