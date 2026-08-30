"use client";

import { useEffect, useState } from "react";
import type { Cliente } from "@/lib/types";

interface Props {
  clienteSelecionado: Cliente | null;
  onSelecionar: (cliente: Cliente) => void;
}

export default function FormCliente({ clienteSelecionado, onSelecionar }: Props) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: "", razao_social: "", email: "", telefone: "", endereco: "", cnpj_cpf: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!busca) {
      setResultados([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/clientes?busca=${encodeURIComponent(busca)}`)
        .then((r) => r.json())
        .then(setResultados);
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  async function criarCliente() {
    if (!novoCliente.nome) return;
    setSalvando(true);
    try {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novoCliente),
      });
      if (response.ok) {
        const cliente: Cliente = await response.json();
        onSelecionar(cliente);
        setMostrarNovo(false);
      }
    } finally {
      setSalvando(false);
    }
  }

  if (clienteSelecionado) {
    return (
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Cliente selecionado</p>
            <p className="text-lg font-semibold">{clienteSelecionado.nome}</p>
            {clienteSelecionado.email && <p className="text-sm text-gray-500">{clienteSelecionado.email}</p>}
            {clienteSelecionado.telefone && <p className="text-sm text-gray-500">{clienteSelecionado.telefone}</p>}
          </div>
          <button type="button" className="text-sm text-brand hover:underline" onClick={() => onSelecionar(null as unknown as Cliente)}>
            Trocar cliente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label-field">Buscar cliente existente</label>
        <input
          className="input-field"
          placeholder="Digite o nome do cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {resultados.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {resultados.map((cliente) => (
              <li key={cliente.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => onSelecionar(cliente)}
                >
                  {cliente.nome} {cliente.email && <span className="text-gray-400">· {cliente.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button type="button" className="text-sm text-accent hover:underline" onClick={() => setMostrarNovo((v) => !v)}>
          {mostrarNovo ? "Cancelar" : "+ Cadastrar novo cliente"}
        </button>
      </div>

      {mostrarNovo && (
        <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Nome Fantasia *</label>
            <input
              className="input-field"
              value={novoCliente.nome}
              onChange={(e) => setNovoCliente((prev) => ({ ...prev, nome: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-field">Razão Social</label>
            <input
              className="input-field"
              value={novoCliente.razao_social}
              onChange={(e) => setNovoCliente((prev) => ({ ...prev, razao_social: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-field">Email</label>
            <input
              className="input-field"
              value={novoCliente.email}
              onChange={(e) => setNovoCliente((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-field">Telefone</label>
            <input
              className="input-field"
              value={novoCliente.telefone}
              onChange={(e) => setNovoCliente((prev) => ({ ...prev, telefone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-field">CNPJ/CPF</label>
            <input
              className="input-field"
              value={novoCliente.cnpj_cpf}
              onChange={(e) => setNovoCliente((prev) => ({ ...prev, cnpj_cpf: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Endereço</label>
            <input
              className="input-field"
              value={novoCliente.endereco}
              onChange={(e) => setNovoCliente((prev) => ({ ...prev, endereco: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="button" className="btn-primary" onClick={criarCliente} disabled={salvando || !novoCliente.nome}>
              {salvando ? "Salvando..." : "Salvar cliente e continuar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
