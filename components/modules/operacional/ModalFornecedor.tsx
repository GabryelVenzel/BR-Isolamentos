"use client";

import { useState } from "react";
import { toast } from "./toast";
import FornecedorAnexos from "./FornecedorAnexos";
import { ESTADOS_BRASIL } from "@/lib/estados-brasil";
import type { CategoriaFornecimento, Fornecedor } from "@/lib/types/domain";

interface Props {
  fornecedor: Fornecedor | null;
  onFechar: () => void;
  onSalvo: () => void;
}

const CATEGORIAS: Array<{ valor: CategoriaFornecimento; label: string }> = [
  { valor: "isolantes", label: "Isolantes" },
  { valor: "chaparia", label: "Chaparia" },
  { valor: "ferramentas", label: "Ferramentas" },
  { valor: "ferragens", label: "Ferragens" },
  { valor: "outros", label: "Outros" },
];

interface Form {
  nome: string;
  razaoSocial: string;
  telefone: string;
  cnpj: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  tiposFornecimento: CategoriaFornecimento[];
  pessoaContato: string;
  notas: string;
}

function paraForm(f: Fornecedor | null): Form {
  return {
    nome: f?.nome ?? "",
    razaoSocial: f?.razao_social ?? "",
    telefone: f?.telefone ?? "",
    cnpj: f?.cnpj ?? "",
    email: f?.email ?? "",
    endereco: f?.endereco ?? "",
    cidade: f?.cidade ?? "",
    estado: f?.estado ?? "",
    tiposFornecimento: f?.tipos_fornecimento ?? [],
    pessoaContato: f?.pessoa_contato ?? "",
    notas: f?.notas ?? "",
  };
}

export default function ModalFornecedor({ fornecedor, onFechar, onSalvo }: Props) {
  const [form, setForm] = useState<Form>(paraForm(fornecedor));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarCategoria(categoria: CategoriaFornecimento) {
    setForm((prev) => ({
      ...prev,
      tiposFornecimento: prev.tiposFornecimento.includes(categoria)
        ? prev.tiposFornecimento.filter((c) => c !== categoria)
        : [...prev.tiposFornecimento, categoria],
    }));
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do fornecedor.");
      return;
    }
    if (form.tiposFornecimento.length === 0) {
      setErro("Selecione pelo menos um tipo de fornecimento.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const payload = {
      nome: form.nome,
      razao_social: form.razaoSocial || null,
      telefone: form.telefone || null,
      cnpj: form.cnpj || null,
      email: form.email || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      tipos_fornecimento: form.tiposFornecimento,
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">
                Nome Fantasia<span className="text-status-error"> *</span>
              </label>
              <input className="input-field" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Razão Social</label>
              <input
                className="input-field"
                value={form.razaoSocial}
                onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))}
              />
            </div>
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
              <label className="label-field">
                Estado<span className="text-status-error"> *</span>
              </label>
              <select className="input-field" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
                <option value="">Selecione...</option>
                {ESTADOS_BRASIL.map((uf) => (
                  <option key={uf.sigla} value={uf.sigla}>
                    {uf.sigla} ({uf.nome})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="label-field mb-2">
              Tipo de fornecimento<span className="text-status-error"> *</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIAS.map((c) => (
                <label key={c.valor} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.tiposFornecimento.includes(c.valor)} onChange={() => alternarCategoria(c.valor)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">Notas</label>
            <textarea className="input-field" rows={3} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
          </div>

          {/* Anexos só na edição (mesmo padrão de ModalParceiro.tsx) — um
              fornecedor recém-criado ainda não tem `id` real pra associar os
              documentos. */}
          {fornecedor && (
            <div className="border-t border-gray-100 pt-4">
              <FornecedorAnexos fornecedorId={fornecedor.id} />
            </div>
          )}

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
