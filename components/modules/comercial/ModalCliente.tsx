"use client";

import { useState } from "react";
import { CampoCep, CampoCnpj, CampoCpf, CampoTelefone } from "@/components/ui/CamposDocumento";
import { toast } from "./toast";
import type { Cliente } from "@/lib/types";
import FecharComEsc from "@/components/ui/FecharComEsc";

interface Props {
  cliente: Cliente | null; // null = criar novo
  onFechar: () => void;
  onSalvo: () => void;
}

interface FormCliente {
  nome: string;
  razaoSocial: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
  cnpj_cpf: string;
}

function paraForm(cliente: Cliente | null): FormCliente {
  return {
    nome: cliente?.nome ?? "",
    razaoSocial: cliente?.razao_social ?? "",
    telefone: cliente?.telefone ?? "",
    email: cliente?.email ?? "",
    cep: cliente?.cep ?? "",
    endereco: cliente?.endereco ?? "",
    cidade: cliente?.cidade ?? "",
    estado: cliente?.estado ?? "",
    cnpj_cpf: cliente?.cnpj_cpf ?? "",
  };
}

/** Modal de criar/editar cliente da aba "Clientes" — diferente de
 * NovoLeadModal (que reaproveita FormCliente pra buscar-ou-criar dentro do
 * fluxo de criação de lead), este é o CRUD dedicado da aba, com todos os
 * campos do mockup (inclusive cidade/estado, que FormCliente não tem). */
export default function ModalCliente({ cliente, onFechar, onSalvo }: Props) {
  const [form, setForm] = useState<FormCliente>(paraForm(cliente));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof FormCliente>(campo: K, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do cliente.");
      return;
    }
    setErro(null);
    setSalvando(true);

    const payload = {
      nome: form.nome,
      razao_social: form.razaoSocial || null,
      telefone: form.telefone || null,
      email: form.email || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      cnpj_cpf: form.cnpj_cpf || null,
    };

    try {
      const response = cliente
        ? await fetch(`/api/clientes/${cliente.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/clientes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok) {
        setErro(data.error ?? "Erro ao salvar cliente.");
        return;
      }

      toast.sucesso(cliente ? "Cliente atualizado." : "Cliente cadastrado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">{cliente ? "Editar Cliente" : "Novo Cliente"}</h2>

        <div className="space-y-4">
          <div>
            <label className="label-field">CNPJ/CPF</label>
            <CampoCnpj
              aceitaCpf
              value={form.cnpj_cpf}
              onChange={(v) => set("cnpj_cpf", v)}
              onDados={(d) =>
                // Só preenche o que estiver vazio — não sobrescreve o que já foi digitado.
                setForm((f) => ({
                  ...f,
                  nome: f.nome || d.nomeFantasia || d.razaoSocial,
                  razaoSocial: f.razaoSocial || d.razaoSocial,
                  telefone: f.telefone || d.telefone,
                  email: f.email || d.email,
                  cep: f.cep || d.cep,
                  endereco: f.endereco || d.endereco,
                  cidade: f.cidade || d.cidade,
                  estado: f.estado || d.estado,
                }))
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">
                Nome Fantasia<span className="text-status-error"> *</span>
              </label>
              <input className="input-field" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div>
              <label className="label-field">Razão Social</label>
              <input className="input-field" value={form.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Telefone</label>
              <CampoTelefone value={form.telefone} onChange={(v) => set("telefone", v)} />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="label-field">CEP</label>
              <CampoCep
                value={form.cep}
                onChange={(v) => set("cep", v)}
                onEndereco={(d) => setForm((f) => ({ ...f, endereco: d.endereco, cidade: d.cidade, estado: d.estado }))}
              />
            </div>
            <div>
              <label className="label-field">Endereço</label>
              <input className="input-field" value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
            </div>
            <div>
              <label className="label-field">Cidade</label>
              <input className="input-field" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </div>
            <div>
              <label className="label-field">Estado</label>
              <input className="input-field" maxLength={2} value={form.estado} onChange={(e) => set("estado", e.target.value.toUpperCase())} />
            </div>
          </div>

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : cliente ? "Salvar alterações" : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
