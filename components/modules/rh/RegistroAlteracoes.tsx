"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { formatarDataHora } from "@/lib/format";
import type { RegistroAuditoria } from "@/lib/repositories";

const LABEL_ACAO: Record<RegistroAuditoria["acao"], string> = { inclusao: "Inclusão", alteracao: "Alteração", exclusao: "Exclusão" };
const CLASSE_ACAO: Record<RegistroAuditoria["acao"], string> = {
  inclusao: "bg-accent-light text-accent-dark",
  alteracao: "bg-secondary-light text-brand",
  exclusao: "bg-red-100 text-status-error",
};

/** Nome legível de cada tabela auditada (ver lista em sql-migration-039). */
const LABEL_TABELA: Record<string, string> = {
  usuarios: "Usuários",
  clientes: "Clientes",
  leads: "Leads",
  orcamentos: "Orçamentos",
  servicos: "Serviços",
  servico_parceiros_execucao: "Parceiros do serviço",
  parceiros: "Parceiros",
  fornecedores: "Fornecedores",
  lancamentos_financeiros: "Lançamentos",
  custos_fixos: "Custos fixos",
  categorias_lancamentos: "Categorias financeiras",
  funcionarios: "Funcionários",
  funcionario_anexos: "Documentos de funcionário",
  documentos_empresa: "Documentos da empresa",
  anexos_lead: "Anexos de lead",
  parceiro_anexos: "Anexos de parceiro",
  fornecedor_anexos: "Anexos de fornecedor",
  precos_config: "Catálogo de preços",
  impostos_config: "Impostos",
  config_empresa: "Configuração da empresa",
  config_financeiro: "Configuração financeira",
  config_prazo_etapas: "Prazos por etapa",
  config_reativacao_leads_frios: "Reativação de leads frios",
};

function textoValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

function ehMudanca(valor: unknown): valor is { de: unknown; para: unknown } {
  return typeof valor === "object" && valor !== null && "de" in valor && "para" in valor;
}

export default function RegistroAlteracoes() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(50);
  const [tabela, setTabela] = useState("");
  const [acao, setAcao] = useState("");
  const [usuario, setUsuario] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ pagina: String(pagina) });
      if (tabela) params.set("tabela", tabela);
      if (acao) params.set("acao", acao);
      if (usuario.trim()) params.set("usuario", usuario.trim().toLowerCase());
      if (de) params.set("de", de);
      if (ate) params.set("ate", ate);

      const response = await fetch(`/api/rh/auditoria?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível carregar o registro de alterações.");
        return;
      }
      setRegistros(payload.data);
      setTotal(payload.meta?.total ?? 0);
      setTamanhoPagina(payload.meta?.pageSize ?? 50);
    } catch {
      setErro("Erro de conexão ao carregar o registro de alterações.");
    } finally {
      setCarregando(false);
    }
  }, [pagina, tabela, acao, usuario, de, ate]);

  useEffect(() => {
    const timeout = setTimeout(carregar, 300);
    return () => clearTimeout(timeout);
  }, [carregar]);

  // Qualquer filtro novo volta pra primeira página.
  function filtrar<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setPagina(1);
      setter(valor);
    };
  }

  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label-field" htmlFor="aud-tabela">
            Onde
          </label>
          <select id="aud-tabela" className="input-field" value={tabela} onChange={(e) => filtrar(setTabela)(e.target.value)}>
            <option value="">Tudo</option>
            {Object.entries(LABEL_TABELA).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field" htmlFor="aud-acao">
            Ação
          </label>
          <select id="aud-acao" className="input-field" value={acao} onChange={(e) => filtrar(setAcao)(e.target.value)}>
            <option value="">Todas</option>
            <option value="inclusao">Inclusão</option>
            <option value="alteracao">Alteração</option>
            <option value="exclusao">Exclusão</option>
          </select>
        </div>
        <div>
          <label className="label-field" htmlFor="aud-usuario">
            E-mail de quem fez
          </label>
          <input id="aud-usuario" className="input-field" value={usuario} onChange={(e) => filtrar(setUsuario)(e.target.value)} />
        </div>
        <div>
          <label className="label-field" htmlFor="aud-de">
            De
          </label>
          <input id="aud-de" type="date" className="input-field" value={de} onChange={(e) => filtrar(setDe)(e.target.value)} />
        </div>
        <div>
          <label className="label-field" htmlFor="aud-ate">
            Até
          </label>
          <input id="aud-ate" type="date" className="input-field" value={ate} onChange={(e) => filtrar(setAte)(e.target.value)} />
        </div>
      </div>

      {erro && <p className="text-sm text-status-error">{erro}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-2 text-left">Quando</th>
              <th className="px-4 py-2 text-left">Quem</th>
              <th className="px-4 py-2 text-left">Ação</th>
              <th className="px-4 py-2 text-left">Onde</th>
              <th className="px-4 py-2 text-left">Registro</th>
              <th className="px-4 py-2 text-right">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {registros.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{formatarDataHora(r.data)}</td>
                  <td className="px-4 py-2">{r.usuario_email ?? "Sistema"}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${CLASSE_ACAO[r.acao]}`}>{LABEL_ACAO[r.acao]}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{LABEL_TABELA[r.tabela] ?? r.tabela}</td>
                  <td className="px-4 py-2">{r.registro_rotulo ?? r.registro_id ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand hover:underline"
                      aria-expanded={aberto === r.id}
                      onClick={() => setAberto((atual) => (atual === r.id ? null : r.id))}
                    >
                      {aberto === r.id ? "Ocultar" : "Ver"}
                    </button>
                  </td>
                </tr>
                {aberto === r.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-4 py-3">
                      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        {Object.entries(r.detalhes ?? {}).map(([campo, valor]) => (
                          <div key={campo} className="flex gap-2 break-all">
                            <dt className="shrink-0 font-semibold text-brand">{campo}:</dt>
                            <dd className="text-gray-600">
                              {ehMudanca(valor) ? `${textoValor(valor.de)} → ${textoValor(valor.para)}` : textoValor(valor)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!carregando && registros.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Nenhuma alteração registrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <span>
          {carregando ? "Carregando..." : `${total} registro${total === 1 ? "" : "s"} — página ${pagina} de ${totalPaginas}`}
        </span>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
