"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ToastContainer from "@/components/modules/operacional/ToastContainer";
import { toast } from "@/components/modules/operacional/toast";
import ModalParceiro from "@/components/modules/operacional/ModalParceiro";
import { TIPOS_TRABALHO_OPCOES } from "@/components/modules/operacional/MultiSelectTiposTrabalho";
import { formatarNumero } from "@/lib/format";
import type { CategoriaParceiro, Parceiro, TipoTrabalhoOperacional } from "@/lib/types/domain";

// Lista revisada (migração 027) — 2 chaves antigas (`isolamentos_removiveis`/
// `isolamentos_fixos`) continuam no mapa só pra parceiros já cadastrados não
// mostrarem o valor cru do banco na coluna "Trabalhos" enquanto não forem
// reclassificados manualmente (ver sql-migration-027).
const LABEL_TIPO: Record<string, string> = {
  ...Object.fromEntries(TIPOS_TRABALHO_OPCOES.map((o) => [o.valor, o.label])),
  isolamentos_removiveis: "Isolamentos Removíveis (categoria antiga)",
  isolamentos_fixos: "Isolamentos Fixos (categoria antiga)",
};

const LABEL_CATEGORIA: Record<CategoriaParceiro, string> = {
  prestador: "Prestador",
  parceria: "Parceria",
  ambos: "Ambos",
};

const CLASSES_CATEGORIA: Record<CategoriaParceiro, string> = {
  prestador: "bg-brand-light text-brand",
  parceria: "bg-accent-light text-accent-dark",
  ambos: "bg-secondary-light text-brand",
};

/** Cadastro de parceiros de instalação — capacidade "mobilizadas/
 * disponíveis" (colunas do mockup) não é mostrada nesta tabela porque é
 * relativa a um DIA específico (ver aba Capacidade, que tem essa
 * granularidade); aqui só a capacidade TOTAL cadastrada é exibida. */
export default function ParceirosPage() {
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Parceiro | "novo" | null>(null);
  // Filtros novos (migração 027) — categoria (Prestador/Parceria/Ambos) e
  // tipo de trabalho (múltipla escolha, mostra quem tem PELO MENOS um dos
  // tipos marcados — mesmo critério de FiltroFornecedores.tsx).
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaParceiro | "">("");
  const [tiposFiltro, setTiposFiltro] = useState<TipoTrabalhoOperacional[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch("/api/operacional/parceiros");
      const payload = await response.json();
      if (payload.success) setParceiros(payload.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(parceiro: Parceiro) {
    if (!confirm(`Excluir o parceiro "${parceiro.nome}"?`)) return;
    const response = await fetch(`/api/operacional/parceiros/${parceiro.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(
        data.error ??
          "Não foi possível excluir o parceiro — verifique se ele não tem serviços vinculados."
      );
      return;
    }
    toast.sucesso("Parceiro excluído.");
    carregar();
  }

  const parceirosFiltrados = useMemo(() => {
    return parceiros
      .filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))
      .filter((p) => !categoriaFiltro || p.categoria_parceiro === categoriaFiltro)
      .filter((p) => tiposFiltro.length === 0 || tiposFiltro.some((t) => (p.tipos_trabalho ?? []).includes(t)));
  }, [parceiros, busca, categoriaFiltro, tiposFiltro]);

  // Indicadores (migração 027) — contagem por categoria, só entre ativos
  // (parceiro inativo não conta pra "quantos temos disponíveis").
  const indicadores = useMemo(() => {
    const ativos = parceiros.filter((p) => p.ativo);
    return {
      prestadores: ativos.filter((p) => p.categoria_parceiro === "prestador").length,
      parcerias: ativos.filter((p) => p.categoria_parceiro === "parceria").length,
      ambos: ativos.filter((p) => p.categoria_parceiro === "ambos").length,
    };
  }, [parceiros]);

  function alternarTipoFiltro(tipo: TipoTrabalhoOperacional) {
    setTiposFiltro((prev) => (prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]));
  }

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Parceiros</h1>
          <p className="text-sm text-gray-500">Cadastro de mão de obra parceira e parcerias de indicação.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card text-center">
          <p className="text-xs uppercase text-gray-500">Prestadores ativos</p>
          <p className="font-montserrat text-2xl font-bold text-brand">{indicadores.prestadores}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase text-gray-500">Parcerias ativas</p>
          <p className="font-montserrat text-2xl font-bold text-accent">{indicadores.parcerias}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase text-gray-500">Ambos ativos</p>
          <p className="font-montserrat text-2xl font-bold text-brand">{indicadores.ambos}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input-field max-w-xs" placeholder="Buscar parceiro..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
          + Novo Parceiro
        </button>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="label-field">Categoria</label>
            <select
              className="input-field"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value as CategoriaParceiro | "")}
            >
              <option value="">Todas</option>
              <option value="prestador">Prestador</option>
              <option value="parceria">Parceria</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
        </div>
        <div>
          <p className="label-field mb-2">Tipo de trabalho</p>
          <div className="flex flex-wrap gap-3">
            {TIPOS_TRABALHO_OPCOES.map((t) => (
              <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={tiposFiltro.includes(t.valor)} onChange={() => alternarTipoFiltro(t.valor)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        {(categoriaFiltro || tiposFiltro.length > 0) && (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              setCategoriaFiltro("");
              setTiposFiltro([]);
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Categoria</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">CNPJ</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left">Trabalhos</th>
                <th className="px-4 py-2 text-right">Capacidade</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parceirosFiltrados.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.numero_parceiro ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-brand">{p.nome}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${CLASSES_CATEGORIA[p.categoria_parceiro]}`}>{LABEL_CATEGORIA[p.categoria_parceiro]}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{p.telefone ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{p.cnpj ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{p.estado ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {(p.tipos_trabalho ?? []).length > 0 ? p.tipos_trabalho.map((t) => LABEL_TIPO[t] ?? t).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    {p.total_pessoas != null ? `${formatarNumero(p.total_pessoas, 0)} pessoas` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`badge ${p.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-500"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" className="p-1 hover:opacity-70" title="Editar" onClick={() => setEditando(p)}>
                        ✏️
                      </button>
                      <button type="button" className="p-1 hover:opacity-70" title="Excluir" onClick={() => excluir(p)}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {parceirosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-400">
                    {parceiros.length === 0 ? "Nenhum parceiro cadastrado." : "Nenhum parceiro corresponde ao filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <ModalParceiro
          parceiro={editando === "novo" ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
