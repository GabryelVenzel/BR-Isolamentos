"use client";

import { useCallback, useEffect, useState } from "react";
import { formatarMoeda } from "@/lib/format";
import type { Parceiro } from "@/lib/types/domain";

const FORM_INICIAL = {
  nome: "",
  email: "",
  telefone: "",
  cidade: "",
  estado: "",
  especialidades: "",
  custo_hora: "",
  disponibilidade_horas_semana: "",
};

export default function ParceirosPage() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const response = await fetch("/api/operacional/parceiros");
    const payload = await response.json();
    if (payload.success) setParceiros(payload.data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    if (!form.nome.trim()) {
      setErro("Informe o nome do parceiro.");
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const response = await fetch("/api/operacional/parceiros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email || null,
          telefone: form.telefone || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
          especialidades: form.especialidades
            ? form.especialidades.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          custo_hora: form.custo_hora ? Number(form.custo_hora) : null,
          disponibilidade_horas_semana: form.disponibilidade_horas_semana
            ? Number(form.disponibilidade_horas_semana)
            : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Erro ao criar parceiro.");
        return;
      }
      setForm(FORM_INICIAL);
      setMostrarForm(false);
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(parceiro: Parceiro) {
    const response = await fetch(`/api/operacional/parceiros/${parceiro.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !parceiro.ativo }),
    });
    const payload = await response.json();
    if (payload.success) setParceiros((prev) => prev.map((p) => (p.id === parceiro.id ? payload.data : p)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Parceiros</h1>
          <p className="text-sm text-gray-500">Cadastro de mão de obra parceira para instalação.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? "Cancelar" : "+ Novo Parceiro"}
        </button>
      </div>

      {mostrarForm && (
        <div className="card space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Nome *</label>
              <input className="input-field" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">E-mail</label>
              <input className="input-field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Telefone</label>
              <input className="input-field" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Cidade</label>
                <input className="input-field" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
              </div>
              <div>
                <label className="label-field">UF</label>
                <input maxLength={2} className="input-field" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Especialidades (separadas por vírgula)</label>
              <input
                className="input-field"
                placeholder="Isolamento térmico, solda, elétrica..."
                value={form.especialidades}
                onChange={(e) => setForm((f) => ({ ...f, especialidades: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">Custo/hora (R$)</label>
              <input type="number" step="0.01" className="input-field" value={form.custo_hora} onChange={(e) => setForm((f) => ({ ...f, custo_hora: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Disponibilidade (h/semana)</label>
              <input type="number" step="1" className="input-field" value={form.disponibilidade_horas_semana} onChange={(e) => setForm((f) => ({ ...f, disponibilidade_horas_semana: e.target.value }))} />
            </div>
          </div>
          {erro && <p className="text-sm text-status-error">{erro}</p>}
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar parceiro"}
          </button>
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="table-header">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Especialidades</th>
                <th className="px-4 py-3 text-right">Custo/hora</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parceiros.map((parceiro) => (
                <tr key={parceiro.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-brand">{parceiro.nome}</td>
                  <td className="px-4 py-3">
                    {parceiro.cidade ?? "—"} {parceiro.estado ? `/${parceiro.estado}` : ""}
                  </td>
                  <td className="px-4 py-3">{parceiro.especialidades.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {parceiro.custo_hora != null ? formatarMoeda(parceiro.custo_hora) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`badge ${parceiro.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-700"}`}
                      onClick={() => alternarAtivo(parceiro)}
                    >
                      {parceiro.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                </tr>
              ))}
              {parceiros.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Nenhum parceiro cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
