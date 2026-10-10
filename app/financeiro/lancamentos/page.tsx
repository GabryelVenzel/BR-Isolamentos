"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Paperclip, Pencil, Trash2 } from "lucide-react";
import ModalLancamento from "@/components/modules/financeiro/ModalLancamento";
import { toast } from "@/components/modules/financeiro/toast";
import { confirmar, escolher } from "@/components/ui/confirmar";
import {
  FORMAS_PAGAMENTO,
  LABEL_FORMA_PAGAMENTO,
  hojeBrasilia,
  labelSituacao,
  situacaoLancamento,
  somarMeses,
  totaisLancamentos,
  type SituacaoLancamento,
} from "@/lib/financeiro";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { CategoriaLancamento, LancamentoFinanceiro } from "@/lib/types/domain";

type Periodo = "mes_atual" | "mes_anterior" | "proximos_30" | "ano_atual" | "tudo" | "personalizado";

const PERIODOS: Array<{ valor: Periodo; label: string }> = [
  { valor: "mes_atual", label: "Este mês" },
  { valor: "mes_anterior", label: "Mês passado" },
  { valor: "proximos_30", label: "Próximos 30 dias" },
  { valor: "ano_atual", label: "Este ano" },
  { valor: "tudo", label: "Todo o período" },
  { valor: "personalizado", label: "Personalizado" },
];

const CHAVE_PERIODO = "br-isolamentos:lancamentos-periodo";

const CLASSE_SITUACAO: Record<SituacaoLancamento, string> = {
  pago: "bg-accent-light text-accent-dark",
  vencido: "bg-red-100 text-status-error",
  vence_hoje: "bg-secondary-light text-brand",
  a_vencer: "bg-gray-100 text-gray-600",
};

/** Intervalo de VENCIMENTO de cada período (datas YYYY-MM-DD, inclusivas). */
function intervaloDoPeriodo(periodo: Periodo, de: string, ate: string): { inicio?: string; fim?: string } {
  const hoje = hojeBrasilia();
  const primeiroDoMes = `${hoje.slice(0, 7)}-01`;
  const ultimoDia = (primeiro: string) => {
    const proximo = somarMeses(primeiro, 1);
    const d = new Date(`${proximo}T00:00:00Z`);
    d.setUTCDate(0);
    return d.toISOString().slice(0, 10);
  };
  switch (periodo) {
    case "mes_atual":
      return { inicio: primeiroDoMes, fim: ultimoDia(primeiroDoMes) };
    case "mes_anterior": {
      const primeiro = somarMeses(primeiroDoMes, -1);
      return { inicio: primeiro, fim: ultimoDia(primeiro) };
    }
    case "proximos_30": {
      const d = new Date(`${hoje}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 30);
      return { inicio: hoje, fim: d.toISOString().slice(0, 10) };
    }
    case "ano_atual":
      return { inicio: `${hoje.slice(0, 4)}-01-01`, fim: `${hoje.slice(0, 4)}-12-31` };
    case "personalizado":
      return { inicio: de || undefined, fim: ate || undefined };
    default:
      return {};
  }
}

/** Texto de apoio abaixo da descrição: a que o lançamento está ligado. */
function vinculos(l: LancamentoFinanceiro): string[] {
  const partes: string[] = [];
  if (l.servico) partes.push(`${l.servico.numero_servico}${l.servico.cliente?.nome ? ` · ${l.servico.cliente.nome}` : ""}`);
  if (l.fornecedor) partes.push(`Fornecedor: ${l.fornecedor.nome}`);
  if (l.parceiro) partes.push(`Parceiro: ${l.parceiro.nome}`);
  if (l.forma_pagamento) partes.push(LABEL_FORMA_PAGAMENTO[l.forma_pagamento]);
  return partes;
}

function baixarCsv(lancamentos: LancamentoFinanceiro[]) {
  const hoje = hojeBrasilia();
  const numero = (v: number) => v.toFixed(2).replace(".", ",");
  const linhas: string[][] = [
    ["Vencimento", "Competência", "Tipo", "Categoria", "Descrição", "Valor", "Situação", "Data do pagamento", "Forma de pagamento", "Obra", "Cliente da obra", "Fornecedor", "Parceiro", "Parcela", "Anexos"],
    ...lancamentos.map((l) => [
      formatarData(l.data),
      (l.data_competencia ?? l.data).slice(0, 7).split("-").reverse().join("/"),
      l.tipo === "receita" ? "Receita" : "Despesa",
      l.categoria,
      l.descricao,
      numero(l.tipo === "despesa" ? -l.valor : l.valor),
      labelSituacao(situacaoLancamento(l, hoje), l.tipo),
      l.data_pagamento ? formatarData(l.data_pagamento) : "",
      l.forma_pagamento ? LABEL_FORMA_PAGAMENTO[l.forma_pagamento] : "",
      l.servico?.numero_servico ?? "",
      l.servico?.cliente?.nome ?? "",
      l.fornecedor?.nome ?? "",
      l.parceiro?.nome ?? "",
      l.parcela_numero ? `${l.parcela_numero}/${l.parcela_total}` : "",
      String((l.anexos ?? []).length),
    ]),
  ];
  // Ponto e vírgula + BOM: abre direto no Excel em português, com acentos.
  const csv = linhas.map((linha) => linha.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Lancamentos_${hoje}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("mes_atual");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [filtroForma, setFiltroForma] = useState("");

  const [editando, setEditando] = useState<LancamentoFinanceiro | "novo" | null>(null);

  // O período escolhido fica lembrado entre visitas.
  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_PERIODO) as Periodo | null;
    if (salvo && salvo !== "personalizado" && PERIODOS.some((p) => p.valor === salvo)) setPeriodo(salvo);
  }, []);

  function trocarPeriodo(novo: Periodo) {
    setPeriodo(novo);
    window.localStorage.setItem(CHAVE_PERIODO, novo);
  }

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      const { inicio, fim } = intervaloDoPeriodo(periodo, de, ate);
      if (inicio) params.set("data_inicio", inicio);
      if (fim) params.set("data_fim", fim);
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (filtroCategoria) params.set("categoria", filtroCategoria);
      if (filtroForma) params.set("forma_pagamento", filtroForma);

      const response = await fetch(`/api/financeiro/lancamentos?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível carregar os lançamentos.");
        return;
      }
      setLancamentos(payload.data);
    } catch {
      setErro("Erro de conexão ao carregar os lançamentos.");
    } finally {
      setCarregando(false);
    }
  }, [periodo, de, ate, filtroTipo, filtroCategoria, filtroForma]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    fetch("/api/financeiro/categorias")
      .then((r) => r.json())
      .then((p) => p.success && setCategorias(p.data));
  }, []);

  async function marcarPago(lancamento: LancamentoFinanceiro) {
    const response = await fetch(`/api/financeiro/lancamentos/${lancamento.id}/pagar`, { method: "POST" });
    const payload = await response.json();
    if (payload.success) {
      toast.sucesso(lancamento.tipo === "receita" ? "Lançamento marcado como recebido." : "Lançamento marcado como pago.");
      carregar();
    } else {
      toast.erro(payload.error ?? "Não foi possível marcar como pago.");
    }
  }

  async function excluir(lancamento: LancamentoFinanceiro) {
    let emDiante = false;

    // Parcela com outras depois dela: pergunta se sai só esta ou esta e as
    // próximas (ex.: quitou tudo na 10ª de 20 — não precisa excluir uma a uma).
    const temSeguintes = Boolean(lancamento.grupo_id && lancamento.parcela_numero && lancamento.parcela_total && lancamento.parcela_numero < lancamento.parcela_total);
    if (temSeguintes) {
      const restantes = lancamento.parcela_total! - lancamento.parcela_numero!;
      const escolha = await escolher(
        `"${lancamento.descricao}" é a ${lancamento.grupo_tipo === "recorrente" ? "repetição" : "parcela"} ${lancamento.parcela_numero} de ${lancamento.parcela_total}. ${restantes === 1 ? "A seguinte, se ainda estiver em aberto, também pode ser excluída" : `As ${restantes} seguintes que ainda estiverem em aberto também podem ser excluídas`}; o que já foi pago fica.`,
        [
          { valor: "so_esta", label: "Só esta", perigo: true },
          { valor: "em_diante", label: "Esta e as próximas", perigo: true },
        ],
        { titulo: "Excluir parcela" }
      );
      if (!escolha) return;
      emDiante = escolha === "em_diante";
    } else if (!(await confirmar(`Excluir o lançamento "${lancamento.descricao}"?`))) {
      return;
    }

    const response = await fetch(`/api/financeiro/lancamentos/${lancamento.id}${emDiante ? "?escopo=seguintes" : ""}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir o lançamento.");
      return;
    }
    const excluidos: number = data.data?.excluidos ?? 1;
    toast.sucesso(excluidos > 1 ? `${excluidos} lançamentos excluídos.` : "Lançamento excluído.");
    carregar();
  }

  const hoje = hojeBrasilia();
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (filtroSituacao) {
        const situacao = situacaoLancamento(l, hoje);
        if (filtroSituacao === "em_aberto" ? situacao === "pago" : situacao !== filtroSituacao) return false;
      }
      if (!termo) return true;
      return [l.descricao, l.categoria, l.servico?.numero_servico, l.servico?.cliente?.nome, l.fornecedor?.nome, l.parceiro?.nome].some((campo) =>
        campo?.toLowerCase().includes(termo)
      );
    });
  }, [lancamentos, busca, filtroSituacao, hoje]);

  const totais = useMemo(() => totaisLancamentos(filtrados, hoje), [filtrados, hoje]);
  const vencido = totais.vencidoAReceber + totais.vencidoAPagar;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <p className="text-sm text-gray-500">
            {filtrados.length} lançamento{filtrados.length === 1 ? "" : "s"} — {PERIODOS.find((p) => p.valor === periodo)?.label.toLowerCase()}, por
            vencimento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => baixarCsv(filtrados)} disabled={filtrados.length === 0}>
            <Download className="icone mr-2" aria-hidden /> Exportar planilha
          </button>
          <button type="button" className="btn-primary" onClick={() => setEditando("novo")}>
            + Novo Lançamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">A receber</p>
          <p className="mt-1 font-montserrat text-xl font-bold text-accent">{formatarMoeda(totais.aReceber)}</p>
          <p className="text-xs text-gray-500">Recebido: {formatarMoeda(totais.recebido)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">A pagar</p>
          <p className="mt-1 font-montserrat text-xl font-bold text-status-error">{formatarMoeda(totais.aPagar)}</p>
          <p className="text-xs text-gray-500">Pago: {formatarMoeda(totais.pago)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vencido</p>
          <p className={`mt-1 font-montserrat text-xl font-bold ${vencido > 0 ? "text-status-error" : "text-gray-400"}`}>{formatarMoeda(vencido)}</p>
          <p className="text-xs text-gray-500">
            A receber: {formatarMoeda(totais.vencidoAReceber)} · a pagar: {formatarMoeda(totais.vencidoAPagar)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Saldo previsto</p>
          <p className={`mt-1 font-montserrat text-xl font-bold ${totais.saldoPrevisto >= 0 ? "text-brand" : "text-status-error"}`}>
            {formatarMoeda(totais.saldoPrevisto)}
          </p>
          <p className="text-xs text-gray-500">Receitas menos despesas da lista</p>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input
            aria-label="Buscar lançamento"
            className="input-field lg:col-span-2"
            placeholder="Buscar por descrição, obra, fornecedor ou parceiro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select aria-label="Período" className="input-field" value={periodo} onChange={(e) => trocarPeriodo(e.target.value as Periodo)}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
          <select aria-label="Tipo" className="input-field" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <select aria-label="Categoria" className="input-field" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
          <select aria-label="Situação" className="input-field" value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)}>
            <option value="">Todas as situações</option>
            <option value="em_aberto">Em aberto</option>
            <option value="vencido">Vencido</option>
            <option value="vence_hoje">Vence hoje</option>
            <option value="a_vencer">A vencer</option>
            <option value="pago">Pago/Recebido</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {periodo === "personalizado" && (
            <>
              <div>
                <label className="label-field" htmlFor="lanc-de">
                  Vencimento de
                </label>
                <input id="lanc-de" type="date" className="input-field" value={de} onChange={(e) => setDe(e.target.value)} />
              </div>
              <div>
                <label className="label-field" htmlFor="lanc-ate">
                  até
                </label>
                <input id="lanc-ate" type="date" className="input-field" value={ate} onChange={(e) => setAte(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <select aria-label="Forma de pagamento" className="input-field" value={filtroForma} onChange={(e) => setFiltroForma(e.target.value)}>
              <option value="">Todas as formas de pagamento</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {LABEL_FORMA_PAGAMENTO[f]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {erro && (
        <div className="card text-sm text-status-error">
          <p>{erro}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        !erro && (
          <div className="card overflow-x-auto p-0">
            <table className="tabela-cartoes w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2 text-left">Vencimento</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Categoria</th>
                  <th className="px-4 py-2 text-left">Descrição</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-left">Situação</th>
                  <th className="px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((lancamento) => {
                  const situacao = situacaoLancamento(lancamento, hoje);
                  const ligado = vinculos(lancamento);
                  const totalAnexos = (lancamento.anexos ?? []).length;
                  return (
                    <tr key={lancamento.id}>
                      <td data-label="Vencimento" className="whitespace-nowrap px-4 py-2">
                        {formatarData(lancamento.data)}
                      </td>
                      <td data-label="Tipo" className="px-4 py-2">
                        <span className={`badge ${lancamento.tipo === "receita" ? "bg-accent-light text-accent-dark" : "bg-red-100 text-status-error"}`}>
                          {lancamento.tipo === "receita" ? "Receita" : "Despesa"}
                        </span>
                      </td>
                      <td data-label="Categoria" className="px-4 py-2 text-gray-500">
                        {lancamento.categoria}
                      </td>
                      <td data-label="Descrição" className="px-4 py-2">
                        <span className="block">{lancamento.descricao}</span>
                        {ligado.length > 0 && <span className="block text-xs text-gray-500">{ligado.join(" · ")}</span>}
                      </td>
                      <td
                        data-label="Valor"
                        className={`whitespace-nowrap px-4 py-2 text-right font-medium ${lancamento.tipo === "receita" ? "text-accent" : "text-status-error"}`}
                      >
                        {lancamento.tipo === "despesa" && "- "}
                        {formatarMoeda(lancamento.valor)}
                      </td>
                      <td data-label="Situação" className="px-4 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-2 sm:justify-start">
                          <span className={`badge whitespace-nowrap ${CLASSE_SITUACAO[situacao]}`}>{labelSituacao(situacao, lancamento.tipo)}</span>
                          {situacao !== "pago" && (
                            <button type="button" className="whitespace-nowrap text-xs font-semibold text-brand hover:underline" onClick={() => marcarPago(lancamento)}>
                              {lancamento.tipo === "receita" ? "Marcar recebido" : "Marcar pago"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td data-label="Ações" className="whitespace-nowrap px-4 py-2 text-right">
                        {totalAnexos > 0 && (
                          <span className="mr-2 text-xs text-gray-500" title={`${totalAnexos} anexo(s)`}>
                            <Paperclip className="icone" aria-hidden /> {totalAnexos}
                          </span>
                        )}
                        <button type="button" className="mr-2 p-1 hover:opacity-70" title="Editar" aria-label="Editar" onClick={() => setEditando(lancamento)}>
                          <Pencil className="icone" aria-hidden />
                        </button>
                        <button type="button" className="p-1 hover:opacity-70" title="Excluir" aria-label="Excluir" onClick={() => excluir(lancamento)}>
                          <Trash2 className="icone" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                      {lancamentos.length === 0 ? "Nenhum lançamento neste período." : "Nenhum lançamento com esses filtros."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      {editando && (
        <ModalLancamento
          lancamento={editando === "novo" ? null : editando}
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
