"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Carregando } from "@/components/ui/Esqueleto";
import { toast } from "@/components/modules/operacional/toast";
import ModalParceiro from "@/components/modules/operacional/ModalParceiro";
import { TIPOS_TRABALHO_OPCOES } from "@/components/modules/operacional/MultiSelectTiposTrabalho";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import MenuAcoes from "@/components/ui/MenuAcoes";
import PainelFiltros from "@/components/ui/PainelFiltros";
import { confirmar } from "@/components/ui/confirmar";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";
import { formatarNumero } from "@/lib/format";
import type { CategoriaParceiro, Parceiro, TipoTrabalhoOperacional } from "@/lib/types/domain";

// Lista revisada (migração 027) — 2 chaves antigas continuam no mapa só pra
// parceiros já cadastrados não mostrarem o valor cru do banco.
const LABEL_TIPO: Record<string, string> = {
  ...Object.fromEntries(TIPOS_TRABALHO_OPCOES.map((o) => [o.valor, o.label])),
  isolamentos_removiveis: "Isolamentos Removíveis (categoria antiga)",
  isolamentos_fixos: "Isolamentos Fixos (categoria antiga)",
};

const TEXTOS: Record<CategoriaParceiro, { titulo: string; descricao: string; novo: string; vazio: string; base: string }> = {
  prestador: {
    titulo: "Prestadores",
    descricao: "Mão de obra terceirizada — entra na Agenda e pode ser alocada nas obras. Clique para abrir a ficha.",
    novo: "+ Novo Prestador",
    vazio: "Nenhum prestador cadastrado.",
    base: "/operacional/prestadores",
  },
  parceria: {
    titulo: "Parcerias",
    descricao: "Parceiros de indicação — recebem comissão pelos leads indicados. Clique para abrir a ficha.",
    novo: "+ Nova Parceria",
    vazio: "Nenhuma parceria cadastrada.",
    base: "/operacional/parcerias",
  },
};

/** Subabas Prestadores e Parcerias do Operacional (migração 053 — antes uma
 * lista só, com filtro de categoria e a opção "ambos"). */
export default function ListaParceiros({ categoria }: { categoria: CategoriaParceiro }) {
  const textos = TEXTOS[categoria];
  const prestador = categoria === "prestador";
  const router = useRouter();
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  // Tipo de trabalho (só prestadores): mostra quem tem PELO MENOS um dos marcados.
  const [tiposFiltro, setTiposFiltro] = useEstadoLembrado<TipoTrabalhoOperacional[]>("filtros-prestadores", []);
  const [status, setStatus] = useEstadoLembrado<"" | "ativo" | "inativo">(`filtro-status-${categoria}`, "");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const payload = await fetch(`/api/operacional/parceiros?capacidade=${prestador ? "mao_de_obra" : "comissao"}`).then((r) => r.json());
      if (payload.success) setParceiros(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [prestador]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(parceiro: Parceiro) {
    if (!(await confirmar(`Excluir "${parceiro.nome}"?`))) return;
    const response = await fetch(`/api/operacional/parceiros/${parceiro.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir — verifique se não há obras ou leads vinculados.");
      return;
    }
    toast.sucesso("Excluído.");
    carregar();
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return parceiros
      .filter((p) => p.categoria_parceiro === categoria)
      .filter((p) => !termo || [p.nome, p.razao_social, p.cidade].some((c) => c?.toLowerCase().includes(termo)))
      .filter((p) => !status || (status === "ativo" ? p.ativo : !p.ativo))
      .filter((p) => !prestador || tiposFiltro.length === 0 || tiposFiltro.some((t) => (p.tipos_trabalho ?? []).includes(t)));
  }, [parceiros, categoria, busca, status, prestador, tiposFiltro]);

  const alternarTipo = (t: TipoTrabalhoOperacional) => setTiposFiltro(tiposFiltro.includes(t) ? tiposFiltro.filter((x) => x !== t) : [...tiposFiltro, t]);

  const ativos = [
    ...(status ? [{ label: status === "ativo" ? "Ativos" : "Inativos", limpar: () => setStatus("") }] : []),
    ...(prestador ? tiposFiltro.map((t) => ({ label: LABEL_TIPO[t] ?? t, limpar: () => alternarTipo(t) })) : []),
  ];

  return (
    <div className="space-y-4">
      <CabecalhoPagina titulo={textos.titulo} descricao={textos.descricao} acaoPrincipal={{ label: textos.novo, onClick: () => setNovo(true) }} />

      <PainelFiltros
        ativos={ativos}
        busca={<input className="input-field" placeholder="Buscar por nome ou cidade..." value={busca} onChange={(e) => setBusca(e.target.value)} />}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <select aria-label="Status" className="input-field w-full sm:w-44" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">Ativos e inativos</option>
            <option value="ativo">Só ativos</option>
            <option value="inativo">Só inativos</option>
          </select>
          {prestador && (
            <div className="flex flex-wrap gap-3" role="group" aria-label="Tipo de trabalho">
              {TIPOS_TRABALHO_OPCOES.map((t) => (
                <label key={t.valor} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={tiposFiltro.includes(t.valor)} onChange={() => alternarTipo(t.valor)} />
                  {t.label}
                </label>
              ))}
            </div>
          )}
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
                {prestador ? <th className="px-4 py-2 text-left">Trabalhos</th> : <th className="px-4 py-2 text-left">E-mail</th>}
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">CNPJ</th>
                <th className="px-4 py-2 text-left">Cidade</th>
                {prestador && <th className="px-4 py-2 text-right">Capacidade</th>}
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`${textos.base}/${p.id}`)}>
                  <td data-label="Código" className="so-computador px-4 py-2 font-mono text-xs text-gray-500">
                    {p.numero_parceiro ?? "—"}
                  </td>
                  <td data-label="Nome" className="px-4 py-2 font-medium text-brand">
                    {p.nome}
                  </td>
                  {prestador ? (
                    <td data-label="Trabalhos" className="px-4 py-2 text-gray-500">
                      {(p.tipos_trabalho ?? []).length > 0 ? p.tipos_trabalho.map((t) => LABEL_TIPO[t] ?? t).join(", ") : "—"}
                    </td>
                  ) : (
                    <td data-label="E-mail" className="so-computador px-4 py-2 text-gray-500">
                      {p.email ?? "—"}
                    </td>
                  )}
                  <td data-label="Telefone" className={`${prestador ? "so-computador " : ""}px-4 py-2 text-gray-500`}>
                    {p.telefone ?? "—"}
                  </td>
                  <td data-label="CNPJ" className="so-computador px-4 py-2 text-gray-500">
                    {p.cnpj ?? "—"}
                  </td>
                  <td data-label="Cidade" className="so-computador px-4 py-2 text-gray-500">
                    {[p.cidade, p.estado].filter(Boolean).join(" / ") || "—"}
                  </td>
                  {prestador && (
                    <td data-label="Capacidade" className="px-4 py-2 text-right text-gray-500">
                      {p.total_pessoas != null ? `${formatarNumero(p.total_pessoas, 0)} pessoas` : "—"}
                    </td>
                  )}
                  <td data-label="Status" className="px-4 py-2">
                    <span className={`badge ${p.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-500"}`}>{p.ativo ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td data-label="Ações" className="px-2 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                    <MenuAcoes
                      discreto
                      acoes={[
                        { label: "Abrir ficha", href: `${textos.base}/${p.id}` },
                        { label: "Excluir", icone: <Trash2 className="icone" aria-hidden />, perigo: true, onClick: () => excluir(p) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                    {parceiros.some((p) => p.categoria_parceiro === categoria) ? "Nenhum resultado com esses filtros." : textos.vazio}
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
          categoria={categoria}
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
