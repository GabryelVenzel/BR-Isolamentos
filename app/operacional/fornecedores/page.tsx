"use client";

import { Carregando } from "@/components/ui/Esqueleto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/modules/operacional/toast";
import ModalFornecedor from "@/components/modules/operacional/ModalFornecedor";
import FiltroFornecedores from "@/components/modules/operacional/FiltroFornecedores";
import type { CategoriaFornecimento, Fornecedor } from "@/lib/types/domain";
import { confirmar } from "@/components/ui/confirmar";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import MenuAcoes from "@/components/ui/MenuAcoes";
import PainelFiltros from "@/components/ui/PainelFiltros";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";

const LABEL_TIPOS_FORNECIMENTO: Record<string, string> = {
  isolantes: "Isolantes",
  chaparia: "Chaparia",
  ferramentas: "Ferramentas",
  ferragens: "Ferragens",
  outros: "Outros",
};

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const router = useRouter();
  const [tiposFiltro, setTiposFiltro] = useEstadoLembrado<CategoriaFornecimento[]>("filtros-fornecedores", []);
  // Editar abre a ficha em página própria; aqui só o cadastro novo.
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      const response = await fetch(`/api/operacional/fornecedores?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) setFornecedores(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    const timeout = setTimeout(carregar, 300);
    return () => clearTimeout(timeout);
  }, [carregar]);

  async function excluir(fornecedor: Fornecedor) {
    if (!(await confirmar(`Excluir o fornecedor "${fornecedor.nome}"?`))) return;
    const response = await fetch(`/api/operacional/fornecedores/${fornecedor.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir o fornecedor.");
      return;
    }
    toast.sucesso("Fornecedor excluído.");
    carregar();
  }

  // Filtro por tipo é em cima da lista já carregada (busca por nome já é
  // server-side, ver `carregar` acima) — em tempo real, sem round-trip
  // nenhum: mostra quem tem PELO MENOS um dos tipos marcados.
  const fornecedoresFiltrados = useMemo(() => {
    if (tiposFiltro.length === 0) return fornecedores;
    return fornecedores.filter((f) => (f.tipos_fornecimento ?? []).some((t) => tiposFiltro.includes(t)));
  }, [fornecedores, tiposFiltro]);

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Fornecedores"
        descricao="Materiais, equipamentos e serviços de apoio — clique em um fornecedor para abrir a ficha."
        acaoPrincipal={{ label: "+ Novo Fornecedor", onClick: () => setNovo(true) }}
      />

      <PainelFiltros
        busca={<input className="input-field" placeholder="Buscar fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} />}
        ativos={tiposFiltro.map((t) => ({ label: LABEL_TIPOS_FORNECIMENTO[t] ?? t, limpar: () => setTiposFiltro(tiposFiltro.filter((x) => x !== t)) }))}
      >
        <FiltroFornecedores value={tiposFiltro} onChange={setTiposFiltro} />
      </PainelFiltros>

      {carregando ? (
        <Carregando linhas={6} />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tabela-cartoes w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">CNPJ</th>
                <th className="px-4 py-2 text-left">Contato</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-left">Tipos de fornecimento</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fornecedoresFiltrados.map((f) => (
                <tr key={f.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/operacional/fornecedores/${f.id}`)}>
                  <td data-label="Código" className="so-computador px-4 py-2 font-mono text-xs text-gray-500">{f.numero_fornecedor ?? "—"}</td>
                  <td data-label="Nome" className="px-4 py-2 font-medium text-brand">{f.nome}</td>
                  <td data-label="Telefone" className="px-4 py-2 text-gray-500">{f.telefone ?? "—"}</td>
                  <td data-label="CNPJ" className="so-computador px-4 py-2 text-gray-500">{f.cnpj ?? "—"}</td>
                  <td data-label="Contato" className="so-computador px-4 py-2 text-gray-500">{f.pessoa_contato ?? "—"}</td>
                  <td data-label="Estado" className="so-computador px-4 py-2 text-gray-500">{f.estado ?? "—"}</td>
                  <td data-label="Tipos de fornecimento" className="px-4 py-2 text-gray-500">
                    {(f.tipos_fornecimento ?? []).length > 0
                      ? f.tipos_fornecimento.map((t) => LABEL_TIPOS_FORNECIMENTO[t] ?? t).join(", ")
                      : "—"}
                  </td>
                  <td data-label="Ações" className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <MenuAcoes discreto
                      alinhar="direita"
                      acoes={[
                        { label: "Abrir ficha", href: `/operacional/fornecedores/${f.id}` },
                        { label: "Excluir", icone: <Trash2 className="icone" aria-hidden />, perigo: true, onClick: () => excluir(f) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {fornecedoresFiltrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    {fornecedores.length === 0 ? "Nenhum fornecedor cadastrado." : "Nenhum fornecedor com os tipos filtrados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && (
        <p className="text-xs text-gray-400">
          {fornecedoresFiltrados.length} fornecedor{fornecedoresFiltrados.length === 1 ? "" : "es"} encontrado
          {fornecedoresFiltrados.length === 1 ? "" : "s"}.
        </p>
      )}

      {novo && (
        <ModalFornecedor
          fornecedor={null}
          onFechar={() => setNovo(false)}
          onSalvo={() => {
            setNovo(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
