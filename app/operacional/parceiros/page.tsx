"use client";

import { Carregando } from "@/components/ui/Esqueleto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/modules/operacional/toast";
import ModalParceiro from "@/components/modules/operacional/ModalParceiro";
import { TIPOS_TRABALHO_OPCOES } from "@/components/modules/operacional/MultiSelectTiposTrabalho";
import { formatarNumero } from "@/lib/format";
import type { CategoriaParceiro, Parceiro, TipoTrabalhoOperacional } from "@/lib/types/domain";
import { confirmar } from "@/components/ui/confirmar";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import MenuAcoes from "@/components/ui/MenuAcoes";
import PainelFiltros from "@/components/ui/PainelFiltros";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";

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
  const router = useRouter();
  const [busca, setBusca] = useState("");
  // Editar abre a ficha em página própria; aqui só o cadastro novo.
  const [novo, setNovo] = useState(false);
  // Filtros novos (migração 027) — categoria (Prestador/Parceria/Ambos) e
  // tipo de trabalho (múltipla escolha, mostra quem tem PELO MENOS um dos
  // tipos marcados — mesmo critério de FiltroFornecedores.tsx).
  const [filtros, setFiltros] = useEstadoLembrado<{ categoria: CategoriaParceiro | ""; tipos: TipoTrabalhoOperacional[] }>("filtros-parceiros", { categoria: "", tipos: [] });
  const categoriaFiltro = filtros.categoria;
  const tiposFiltro = filtros.tipos;
  const setCategoriaFiltro = (categoria: CategoriaParceiro | "") => setFiltros((f) => ({ ...f, categoria }));
  const setTiposFiltro = (fn: (t: TipoTrabalhoOperacional[]) => TipoTrabalhoOperacional[]) => setFiltros((f) => ({ ...f, tipos: fn(f.tipos) }));

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
    if (!(await confirmar(`Excluir o parceiro "${parceiro.nome}"?`))) return;
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

  function alternarTipoFiltro(tipo: TipoTrabalhoOperacional) {
    setTiposFiltro((prev) => (prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]));
  }

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Parceiros"
        descricao="Mão de obra parceira e parcerias de indicação — clique em um parceiro para abrir a ficha."
        acaoPrincipal={{ label: "+ Novo Parceiro", onClick: () => setNovo(true) }}
      />

      <PainelFiltros
        busca={<input className="input-field" placeholder="Buscar parceiro..." value={busca} onChange={(e) => setBusca(e.target.value)} />}
        ativos={[
          ...(categoriaFiltro ? [{ label: LABEL_CATEGORIA[categoriaFiltro], limpar: () => setCategoriaFiltro("") }] : []),
          ...tiposFiltro.map((t) => ({ label: LABEL_TIPO[t] ?? t, limpar: () => alternarTipoFiltro(t) })),
        ]}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="w-full sm:w-48">
            <select
              aria-label="Categoria"
              className="input-field"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value as CategoriaParceiro | "")}
            >
              <option value="">Todas as categorias</option>
              <option value="prestador">Prestador</option>
              <option value="parceria">Parceria</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-3" role="group" aria-label="Tipo de trabalho">
            {TIPOS_TRABALHO_OPCOES.map((t) => (
              <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={tiposFiltro.includes(t.valor)} onChange={() => alternarTipoFiltro(t.valor)} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
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
                <tr key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/operacional/parceiros/${p.id}`)}>
                  <td data-label="Código" className="so-computador px-4 py-2 font-mono text-xs text-gray-500">{p.numero_parceiro ?? "—"}</td>
                  <td data-label="Nome" className="px-4 py-2 font-medium text-brand">{p.nome}</td>
                  <td data-label="Categoria" className="px-4 py-2">
                    <span className={`badge ${CLASSES_CATEGORIA[p.categoria_parceiro]}`}>{LABEL_CATEGORIA[p.categoria_parceiro]}</span>
                  </td>
                  <td data-label="Telefone" className="so-computador px-4 py-2 text-gray-500">{p.telefone ?? "—"}</td>
                  <td data-label="CNPJ" className="so-computador px-4 py-2 text-gray-500">{p.cnpj ?? "—"}</td>
                  <td data-label="Estado" className="so-computador px-4 py-2 text-gray-500">{p.estado ?? "—"}</td>
                  <td data-label="Trabalhos" className="px-4 py-2 text-gray-500">
                    {(p.tipos_trabalho ?? []).length > 0 ? p.tipos_trabalho.map((t) => LABEL_TIPO[t] ?? t).join(", ") : "—"}
                  </td>
                  <td data-label="Capacidade" className="so-computador px-4 py-2 text-right text-gray-500">
                    {p.total_pessoas != null ? `${formatarNumero(p.total_pessoas, 0)} pessoas` : "—"}
                  </td>
                  <td data-label="Status" className="px-4 py-2">
                    <span className={`badge ${p.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-500"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td data-label="Ações" className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <MenuAcoes discreto
                      alinhar="direita"
                      acoes={[
                        { label: "Abrir ficha", href: `/operacional/parceiros/${p.id}` },
                        { label: "Excluir", icone: <Trash2 className="icone" aria-hidden />, perigo: true, onClick: () => excluir(p) },
                      ]}
                    />
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

      {novo && (
        <ModalParceiro
          parceiro={null}
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
