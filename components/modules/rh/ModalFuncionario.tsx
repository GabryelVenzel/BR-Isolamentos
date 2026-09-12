"use client";

import { useState } from "react";
import { toast } from "./toast";
import FuncionarioAnexos from "./FuncionarioAnexos";
import type { Funcionario, StatusFuncionario } from "@/lib/types/domain";

interface Props {
  funcionario: Funcionario | null;
  onFechar: () => void;
  onSalvo: () => void;
}

const STATUS_OPCOES: Array<{ valor: StatusFuncionario; label: string }> = [
  { valor: "ativo", label: "Ativo" },
  { valor: "inativo", label: "Inativo" },
  { valor: "desligado", label: "Desligado" },
];

interface Form {
  nome: string;
  cargo: string;
  cpf: string;
  telefone: string;
  email: string;
  dataAdmissao: string;
  status: StatusFuncionario;
  notas: string;
}

function paraForm(f: Funcionario | null): Form {
  return {
    nome: f?.nome ?? "",
    cargo: f?.cargo ?? "",
    cpf: f?.cpf ?? "",
    telefone: f?.telefone ?? "",
    email: f?.email ?? "",
    dataAdmissao: f?.data_admissao ?? "",
    status: f?.status ?? "ativo",
    notas: f?.notas ?? "",
  };
}

/** Novo Colaborador / Editar Funcionário — informações básicas do módulo RH
 * (migração 033). Anexos (ASO, NRs, certificações...) só aparecem editando
 * um funcionário já existente, mesmo padrão de ModalFornecedor.tsx (um
 * registro recém-criado ainda não tem `id` real pra associar documentos). */
export default function ModalFuncionario({ funcionario, onFechar, onSalvo }: Props) {
  const [form, setForm] = useState<Form>(paraForm(funcionario));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do funcionário.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const payload = {
      nome: form.nome,
      cargo: form.cargo || null,
      cpf: form.cpf || null,
      telefone: form.telefone || null,
      email: form.email || null,
      data_admissao: form.dataAdmissao || null,
      status: form.status,
      notas: form.notas || null,
    };

    try {
      const response = funcionario
        ? await fetch(`/api/rh/funcionarios/${funcionario.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/rh/funcionarios", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErro(data.error ?? "Erro ao salvar funcionário.");
        return;
      }

      toast.sucesso(funcionario ? "Funcionário atualizado." : "Colaborador cadastrado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">
          {funcionario ? "Editar Funcionário" : "Novo Colaborador"}
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">
                Nome<span className="text-status-error"> *</span>
              </label>
              <input className="input-field" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Cargo</label>
              <input className="input-field" value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">CPF</label>
              <input className="input-field" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Telefone</label>
              <input className="input-field" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input className="input-field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Data de admissão</label>
              <input
                type="date"
                className="input-field"
                value={form.dataAdmissao}
                onChange={(e) => setForm((f) => ({ ...f, dataAdmissao: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">Status</label>
              <select
                className="input-field"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StatusFuncionario }))}
              >
                {STATUS_OPCOES.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label-field">Notas</label>
            <textarea className="input-field" rows={3} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
          </div>

          {/* Anexos só na edição (mesmo padrão de ModalFornecedor.tsx) — um
              funcionário recém-criado ainda não tem `id` real pra associar
              os documentos. */}
          {funcionario && (
            <div className="border-t border-gray-100 pt-4">
              <FuncionarioAnexos funcionarioId={funcionario.id} />
            </div>
          )}

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : funcionario ? "Salvar alterações" : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
