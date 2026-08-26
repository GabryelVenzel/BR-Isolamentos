"use client";

import { useState } from "react";
import { toast } from "./toast";
import type { EspecialidadeFornecedor, Fornecedor } from "@/lib/types/domain";

interface Props {
  fornecedor: Fornecedor | null;
  onFechar: () => void;
  onSalvo: () => void;
}

const ESPECIALIDADES: Array<{ valor: EspecialidadeFornecedor; label: string }> = [
  { valor: "isolantes", label: "Isolantes" },
  { valor: "chaparia", label: "Chaparia" },
  { valor: "ferramentas", label: "Ferramentas" },
  { valor: "ferragens", label: "Ferragens" },
  { valor: "outros", label: "Outros" },
];

interface Form {
  nome: string;
  telefone: string;
  cnpj: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  tipoFornecimento: "materiais" | "equipamentos" | "servicos" | "";
  especialidade: EspecialidadeFornecedor | "";
  pessoaContato: string;
  notas: string;
}

function paraForm(f: Fornecedor | null): Form {
  return {
    nome: f?.nome ?? "",
    telefone: f?.telefone ?? "",
    cnpj: f?.cnpj ?? "",
    email: f?.email ?? "",
    endereco: f?.endereco ?? "",
    cidade: f?.cidade ?? "",
    estado: f?.estado ?? "",
    tipoFornecimento: f?.tipo_fornecimento ?? "",
    especialidade: f?.especialidade ?? "",
    pessoaContato: f?.pessoa_contato ?? "",
    notas: f?.notas ?? "",
  };
}

export default function ModalFornecedor({ fornecedor, onFechar, onSalvo }: Props) {
  const [form, setForm] = useState<Form>(paraForm(fornecedor));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do fornecedor.");
      return;
    }
    if (!form.tipoFornecimento) {
      setErro("Selecione o tipo de fornecimento.");
      return;
    }
    if (!form.especialidade) {
      setErro("Selecione a especialidade do fornecedor.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const payload = {
      nome: form.nome,
      telefone: form.telefone || null,
      cnpj: form.cnpj || null,
      email: form.email || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      tipo_fornecimento: form.tipoFornecimento,
      especialidade: form.especialidade || null,
      pessoa_contato: form.pessoaContato || null,
      notas: form.notas || null,
    };

    try {
      const response = fornecedor
        ? await fetch(`/api/operacional/fornecedores/${fornecedor.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/operacional/fornecedores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErro(data.error ?? "Erro ao salvar fornecedor.");
        return;
      }

      toast.sucesso(fornecedor ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
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
          {fornecedor ? "Editar Fornecedor" : "Novo Fornecedor"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label-field">
              Nome<span className="text-status-error"> *</span>
            </label>
            <input className="input-field" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Telefone</label>
              <input className="input-field" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">CNPJ</label>
              <input className="input-field" value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input className="input-field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Pessoa de contato</label>
              <input className="input-field" value={form.pessoaContato} onChange={(e) => setForm((f) => ({ ...f, pessoaContato: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Endereço</label>
              <input className="input-field" value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Cidade</label>
              <input className="input-field" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Estado</label>
              <input
                className="input-field"
                maxLength={2}
                value={form.estado}
                onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <label className="label-field">
                Tipo de fornecimento<span className="text-status-error"> *</span>
              </label>
              <select
                className="input-field"
                value={form.tipoFornecimento}
                onChange={(e) => setForm((f) => ({ ...f, tipoFornecimento: e.target.value as Form["tipoFornecimento"] }))}
              >
                <option value="">Selecione...</option>
                <option value="materiais">Materiais</option>
                <option value="equipamentos">Equipamentos</option>
                <option value="servicos">Serviços</option>
              </select>
            </div>
            <div>
              <label className="label-field">
                Especialidade<span className="text-status-error"> *</span>
              </label>
              <select
                className="input-field"
                value={form.especialidade}
                onChange={(e) => setForm((f) => ({ ...f, especialidade: e.target.value as EspecialidadeFornecedor }))}
              >
                <option value="">Selecione...</option>
                {ESPECIALIDADES.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label-field">Notas</label>
            <textarea className="input-field" rows={3} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
          </div>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : fornecedor ? "Salvar alterações" : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
