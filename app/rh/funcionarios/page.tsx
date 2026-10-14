"use client";

import { Carregando } from "@/components/ui/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatarData } from "@/lib/format";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";
import { LABEL_AUSENCIA, LABEL_SITUACAO_DOCUMENTACAO, LABEL_VINCULO, type TipoAusencia } from "@/lib/rh";
import type { Funcionario } from "@/lib/types/domain";

const LABEL_STATUS: Record<string, string> = { ativo: "Ativo", inativo: "Inativo", desligado: "Desligado" };
const CLASSE_STATUS: Record<string, string> = {
  ativo: "bg-accent-light text-accent-dark",
  inativo: "bg-secondary-light text-brand",
  desligado: "bg-gray-100 text-gray-500",
};
const CLASSE_DOCUMENTACAO: Record<string, string> = {
  em_dia: "bg-accent-light text-accent-dark",
  vencendo: "bg-secondary-light text-brand",
  vencido: "bg-red-100 text-status-error",
  sem_documentos: "bg-gray-100 text-gray-500",
};

/** Lista de funcionários (migração 052): situação da documentação de cada
 * um (em dia, vencendo, vencido, sem documentos — só conta o documento mais
 * novo de cada tipo), vínculo e quem está ausente hoje. A ficha completa
 * abre em página própria. */
export default function FuncionariosPage() {
  const router = useRouter();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useEstadoLembrado("filtro-funcionarios-status", "ativo");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      if (status) params.set("status", status);
      const payload = await fetch(`/api/rh/funcionarios?${params.toString()}`).then((r) => r.json());
      if (payload.success) setFuncionarios(payload.data);
    } finally {
      setCarregando(false);
    }
  }, [busca, status]);

  useEffect(() => {
    const timeout = setTimeout(carregar, 300);
    return () => clearTimeout(timeout);
  }, [carregar]);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Funcionários"
        descricao="Cadastro dos colaboradores, documentação, EPI, férias e pagamentos — clique em um funcionário para abrir a ficha."
        acaoPrincipal={{ label: "+ Novo Colaborador", href: "/rh/funcionarios/novo" }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <input className="input-field min-w-0 flex-1 sm:w-72 sm:flex-none" placeholder="Buscar funcionário..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select className="input-field w-auto" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="desligado">Desligados</option>
            <option value="">Todos</option>
          </select>
        </div>
      </div>

      {carregando ? (
        <Carregando />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tabela-cartoes w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Código</th>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Cargo</th>
                <th className="px-4 py-2 text-left">Vínculo</th>
                <th className="px-4 py-2 text-left">Admissão</th>
                <th className="px-4 py-2 text-left">Documentação</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {funcionarios.map((f) => {
                const doc = f.documentacao;
                return (
                  <tr key={f.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/rh/funcionarios/${f.id}`)}>
                    <td data-label="Código" className="so-computador px-4 py-2 font-mono text-xs text-gray-500">{f.numero_funcionario ?? "—"}</td>
                    <td data-label="Nome" className="px-4 py-2 font-medium text-brand">
                      <Link href={`/rh/funcionarios/${f.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {f.nome}
                      </Link>
                    </td>
                    <td data-label="Cargo" className="px-4 py-2 text-gray-500">{f.cargo ?? "—"}</td>
                    <td data-label="Vínculo" className="so-computador px-4 py-2 text-gray-500">{f.vinculo ? LABEL_VINCULO[f.vinculo] : "—"}</td>
                    <td data-label="Admissão" className="so-computador px-4 py-2 text-gray-500">{f.data_admissao ? formatarData(f.data_admissao) : "—"}</td>
                    <td data-label="Documentação" className="px-4 py-2">
                      {doc && (
                        <Link
                          href={`/rh/funcionarios/${f.id}?aba=documentos`}
                          onClick={(e) => e.stopPropagation()}
                          className={`badge ${CLASSE_DOCUMENTACAO[doc.situacao]}`}
                          title={doc.vencidos + doc.vencendo > 0 ? `${doc.vencidos} vencido(s), ${doc.vencendo} vencendo` : undefined}
                        >
                          {doc.situacao === "vencido" && doc.vencidos > 1
                            ? `${doc.vencidos} documentos vencidos`
                            : doc.situacao === "vencendo" && doc.vencendo > 1
                              ? `${doc.vencendo} documentos vencendo`
                              : LABEL_SITUACAO_DOCUMENTACAO[doc.situacao]}
                        </Link>
                      )}
                    </td>
                    <td data-label="Status" className="px-4 py-2">
                      <span className={`badge ${CLASSE_STATUS[f.status] ?? "bg-gray-100 text-gray-500"}`}>{LABEL_STATUS[f.status] ?? f.status}</span>
                      {f.ausente_hoje && (
                        <span className="badge ml-1 bg-secondary-light text-brand">
                          {LABEL_AUSENCIA[f.ausente_hoje.tipo as TipoAusencia] ?? "Ausente"} até {formatarData(f.ausente_hoje.fim)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {funcionarios.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Nenhum funcionário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!carregando && (
        <p className="text-xs text-gray-400">
          {funcionarios.length} funcionário{funcionarios.length === 1 ? "" : "s"} encontrado{funcionarios.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
