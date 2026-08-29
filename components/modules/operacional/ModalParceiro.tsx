"use client";

import { useState } from "react";
import { toast } from "./toast";
import ParceiroAnexos from "./ParceiroAnexos";
import { TIPOS_TRABALHO_OPCOES } from "./MultiSelectTiposTrabalho";
import { ESTADOS_BRASIL } from "@/lib/estados-brasil";
import type { CategoriaParceiro, Parceiro, TipoTrabalhoOperacional } from "@/lib/types/domain";

interface Props {
  parceiro: Parceiro | null; // null = criar novo
  onFechar: () => void;
  onSalvo: () => void;
}

// Reaproveita a mesma lista usada no multi-select de tipos de trabalho de um
// Serviço (migração 027) — uma fonte só, evita as duas telas divergirem de
// novo (era o caso antes: esta tinha sua própria cópia da lista de 4).
const TIPOS = TIPOS_TRABALHO_OPCOES;

const CATEGORIAS_PARCEIRO: Array<{ valor: CategoriaParceiro; label: string; descricao: string }> = [
  { valor: "prestador", label: "Prestador", descricao: "Fornece mão de obra — aparece na Agenda e pode ser vinculado a um Serviço." },
  { valor: "parceria", label: "Parceria", descricao: "Só indicação/comissão — não mobiliza gente, não aparece na Agenda." },
  { valor: "ambos", label: "Ambos", descricao: "Fornece mão de obra E recebe indicações de comissão." },
];

interface Form {
  nome: string;
  telefone: string;
  cnpj: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  categoriaParceiro: CategoriaParceiro;
  tiposTrabalho: TipoTrabalhoOperacional[];
  notasBancada: string;
  notasCaldeiraria: string;
  totalPessoas: string;
}

function paraForm(p: Parceiro | null): Form {
  return {
    nome: p?.nome ?? "",
    telefone: p?.telefone ?? "",
    cnpj: p?.cnpj ?? "",
    email: p?.email ?? "",
    endereco: p?.endereco ?? "",
    cidade: p?.cidade ?? "",
    estado: p?.estado ?? "",
    categoriaParceiro: p?.categoria_parceiro ?? "prestador",
    tiposTrabalho: p?.tipos_trabalho ?? [],
    notasBancada: p?.notas_bancada ?? "",
    notasCaldeiraria: p?.notas_caldeiraria ?? "",
    totalPessoas: p?.total_pessoas != null ? String(p.total_pessoas) : "",
  };
}

export default function ModalParceiro({ parceiro, onFechar, onSalvo }: Props) {
  const [form, setForm] = useState<Form>(paraForm(parceiro));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternarTipo(tipo: TipoTrabalhoOperacional) {
    setForm((prev) => ({
      ...prev,
      tiposTrabalho: prev.tiposTrabalho.includes(tipo)
        ? prev.tiposTrabalho.filter((t) => t !== tipo)
        : [...prev.tiposTrabalho, tipo],
    }));
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do parceiro.");
      return;
    }
    if (form.tiposTrabalho.length === 0) {
      setErro("Selecione pelo menos um tipo de trabalho.");
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
      categoria_parceiro: form.categoriaParceiro,
      tipos_trabalho: form.tiposTrabalho,
      notas_bancada: form.tiposTrabalho.includes("bancada") ? form.notasBancada || null : null,
      notas_caldeiraria: form.tiposTrabalho.includes("caldeiraria") ? form.notasCaldeiraria || null : null,
      total_pessoas: form.totalPessoas ? Number(form.totalPessoas) : null,
    };

    try {
      const response = parceiro
        ? await fetch(`/api/operacional/parceiros/${parceiro.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/operacional/parceiros", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErro(data.error ?? "Erro ao salvar parceiro.");
        return;
      }

      toast.sucesso(parceiro ? "Parceiro atualizado." : "Parceiro cadastrado.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4" onClick={onFechar}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-montserrat text-lg font-bold text-brand">
          {parceiro ? "Editar Parceiro" : "Novo Parceiro"}
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label-field">
                Nome<span className="text-status-error"> *</span>
              </label>
              <input className="input-field" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
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
              <label className="label-field">Estado</label>
              <select
                className="input-field"
                value={form.estado}
                onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="">Selecione...</option>
                {ESTADOS_BRASIL.map((uf) => (
                  <option key={uf.sigla} value={uf.sigla}>
                    {uf.sigla} ({uf.nome})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Endereço</label>
              <input className="input-field" value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Cidade</label>
              <input className="input-field" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="label-field mb-2">
              Categoria<span className="text-status-error"> *</span>
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CATEGORIAS_PARCEIRO.map((c) => (
                <label
                  key={c.valor}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm ${
                    form.categoriaParceiro === c.valor ? "border-brand bg-brand-light/40" : "border-gray-200"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-gray-800">
                    <input
                      type="radio"
                      name="categoria_parceiro"
                      checked={form.categoriaParceiro === c.valor}
                      onChange={() => setForm((f) => ({ ...f, categoriaParceiro: c.valor }))}
                    />
                    {c.label}
                  </span>
                  <span className="text-xs text-gray-500">{c.descricao}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="label-field mb-2">
              Tipos de trabalho<span className="text-status-error"> *</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.tiposTrabalho.includes(t.valor)} onChange={() => alternarTipo(t.valor)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {(form.tiposTrabalho.includes("bancada") || form.tiposTrabalho.includes("caldeiraria")) && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="label-field">Notas por tipo de trabalho</p>
              {form.tiposTrabalho.includes("bancada") && (
                <input
                  className="input-field"
                  placeholder="Notas — Bancada"
                  value={form.notasBancada}
                  onChange={(e) => setForm((f) => ({ ...f, notasBancada: e.target.value }))}
                />
              )}
              {form.tiposTrabalho.includes("caldeiraria") && (
                <input
                  className="input-field"
                  placeholder="Notas — Caldeiraria (Fabricação)"
                  value={form.notasCaldeiraria}
                  onChange={(e) => setForm((f) => ({ ...f, notasCaldeiraria: e.target.value }))}
                />
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="label-field">Total de pessoas (capacidade máxima)</label>
            <input
              type="number"
              min={1}
              className="input-field max-w-[10rem]"
              value={form.totalPessoas}
              onChange={(e) => setForm((f) => ({ ...f, totalPessoas: e.target.value }))}
            />
            <p className="mt-1 text-xs text-gray-400">
              Quantas pessoas mobilizadas/disponíveis por dia é calculado a partir dos serviços ativos — ver aba
              Capacidade.
            </p>
          </div>

          {/* Anexos só na edição (pedido explícito) — um parceiro recém-criado
              ainda não tem `id` real pra associar os documentos, e o próprio
              fluxo é "cadastra o parceiro primeiro, documentação depois". */}
          {parceiro && (
            <div className="border-t border-gray-100 pt-4">
              <ParceiroAnexos parceiroId={parceiro.id} />
            </div>
          )}

          {erro && <p className="text-sm text-status-error">{erro}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : parceiro ? "Salvar alterações" : "Cadastrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
