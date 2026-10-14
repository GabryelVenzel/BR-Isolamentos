"use client";

import { EsqueletoLista } from "@/components/ui/Esqueleto";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Paperclip, Pencil, Trash2 } from "lucide-react";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import MenuAcoes from "@/components/ui/MenuAcoes";
import PainelFiltros from "@/components/ui/PainelFiltros";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";
import ModalLancamento from "@/components/modules/financeiro/ModalLancamento";
import { toast } from "@/components/modules/financeiro/toast";
import { confirmar, escolher } from "@/components/ui/confirmar";
import Lixeira from "@/components/Lixeira";
import { useAcesso } from "@/lib/hooks/useAcesso";
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

const ROTULO_SITUACAO: Record<string, string> = {
  em_aberto: "Em aberto",
  vencido: "Vencido",
  vence_hoje: "Vence hoje",
  a_vencer: "A vencer",
  pago: "Pago/Recebido",
};

/** Linhas mostradas por vez — "Carregar mais" traz o próximo bloco. */
const POR_VEZ = 50;

type Ordem = "data" | "descricao" | "valor" | "situacao";
const PESO_SITUACAO: Record<SituacaoLancamento, number> = { vencido: 0, vence_hoje: 1, a_vencer: 2, pago: 3 };

interface Filtros {
  periodo: Periodo;
  tipo: string;
  categoria: string;
  situacao: string;
  forma: string;
}
const FILTROS_INICIAIS: Filtros = { periodo: "mes_atual", tipo: "", categoria: "", situacao: "", forma: "" };

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
  return (
    <Suspense fallback={<EsqueletoLista />}>
      <Lancamentos />
    </Suspense>
  );
}

function Lancamentos() {
  const router = useRouter();
  const params = useSearchParams();
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  // Filtros lembrados entre visitas (revisão de usabilidade); o intervalo
  // personalizado não — ao voltar, "Personalizado" cai para "Este mês".
  const [filtros, setFiltros] = useEstadoLembrado<Filtros>("filtros-lancamentos", FILTROS_INICIAIS);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [personalizado, setPersonalizado] = useState(false);
  const periodo: Periodo = personalizado ? "personalizado" : filtros.periodo;
  const { tipo: filtroTipo, categoria: filtroCategoria, situacao: filtroSituacao, forma: filtroForma } = filtros;
  const filtrar = (campo: keyof Filtros, valor: string) => {
    if (campo === "periodo") {
      setPersonalizado(valor === "personalizado");
      if (valor === "personalizado") return;
    }
    setFiltros((f) => ({ ...f, [campo]: valor }));
  };
  const [ordem, setOrdem] = useState<{ campo: Ordem; asc: boolean }>({ campo: "data", asc: true });
  const [limite, setLimite] = useState(POR_VEZ);

  const [editando, setEditando] = useState<LancamentoFinanceiro | "novo" | null>(null);
  const [mostrarLixeira, setMostrarLixeira] = useState(false);
  const { acesso } = useAcesso();

  // "+ Criar → Lançamento" (cabeçalho) chega aqui com ?novo=1.
  useEffect(() => {
    if (params.get("novo")) {
      setEditando("novo");
      router.replace("/financeiro/lancamentos");
    }
  }, [params, router]);

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
    } else if (
      !(await confirmar(
        `Excluir o lançamento "${lancamento.descricao}"? Ele vai para a lixeira e deixa de contar nos saldos e relatórios; um administrador pode restaurar por 30 dias.`,
        { titulo: "Excluir lançamento", confirmarLabel: "Enviar para a lixeira" }
      ))
    ) {
      return;
    }

    const response = await fetch(`/api/financeiro/lancamentos/${lancamento.id}${emDiante ? "?escopo=seguintes" : ""}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir o lançamento.");
      return;
    }
    const excluidos: number = data.data?.excluidos ?? 1;
    toast.sucesso(excluidos > 1 ? `${excluidos} lançamentos enviados para a lixeira.` : "Lançamento enviado para a lixeira.");
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

  const ordenados = useMemo(() => {
    const sinal = ordem.asc ? 1 : -1;
    const valor = (l: LancamentoFinanceiro) => (l.tipo === "despesa" ? -l.valor : l.valor);
    return [...filtrados].sort((a, b) => {
      let c = 0;
      if (ordem.campo === "data") c = a.data.localeCompare(b.data);
      else if (ordem.campo === "descricao") c = a.descricao.localeCompare(b.descricao, "pt-BR");
      else if (ordem.campo === "valor") c = valor(a) - valor(b);
      else c = PESO_SITUACAO[situacaoLancamento(a, hoje)] - PESO_SITUACAO[situacaoLancamento(b, hoje)];
      return c * sinal || a.data.localeCompare(b.data);
    });
  }, [filtrados, ordem, hoje]);
  const visiveis = ordenados.slice(0, limite);

  // Volta ao primeiro bloco quando a lista muda de filtro/ordem.
  useEffect(() => setLimite(POR_VEZ), [filtros, busca, ordem, de, ate, personalizado]);

  function ordenarPor(campo: Ordem) {
    setOrdem((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: campo !== "valor" }));
  }

  const Cabecalho = ({ campo, children, direita }: { campo: Ordem; children: React.ReactNode; direita?: boolean }) => (
    <th className={`px-4 py-2 ${direita ? "text-right" : "text-left"}`} aria-sort={ordem.campo === campo ? (ordem.asc ? "ascending" : "descending") : undefined}>
      <button type="button" className="inline-flex items-center gap-1 uppercase hover:underline" onClick={() => ordenarPor(campo)}>
        {children}
        {ordem.campo === campo && (ordem.asc ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />)}
      </button>
    </th>
  );

  const acoesDe = (l: LancamentoFinanceiro, situacao: SituacaoLancamento) => [
    { label: "Editar", icone: <Pencil className="icone" aria-hidden />, onClick: () => setEditando(l) },
    ...(situacao !== "pago" ? [{ label: l.tipo === "receita" ? "Marcar recebido" : "Marcar pago", onClick: () => marcarPago(l) }] : []),
    { label: "Excluir", icone: <Trash2 className="icone" aria-hidden />, perigo: true, onClick: () => excluir(l) },
  ];

  const labelPeriodo = PERIODOS.find((p) => p.valor === periodo)?.label ?? "";
  const ativos = [
    ...(periodo !== "mes_atual" ? [{ label: labelPeriodo, limpar: () => filtrar("periodo", "mes_atual") }] : []),
    ...(filtroTipo ? [{ label: filtroTipo === "receita" ? "Receitas" : "Despesas", limpar: () => filtrar("tipo", "") }] : []),
    ...(filtroCategoria ? [{ label: filtroCategoria, limpar: () => filtrar("categoria", "") }] : []),
    ...(filtroSituacao ? [{ label: ROTULO_SITUACAO[filtroSituacao] ?? filtroSituacao, limpar: () => filtrar("situacao", "") }] : []),
    ...(filtroForma ? [{ label: LABEL_FORMA_PAGAMENTO[filtroForma as keyof typeof LABEL_FORMA_PAGAMENTO] ?? filtroForma, limpar: () => filtrar("forma", "") }] : []),
  ];

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Lançamentos"
        descricao={`${filtrados.length} lançamento${filtrados.length === 1 ? "" : "s"} — ${labelPeriodo.toLowerCase()}, por vencimento.`}
        acaoPrincipal={{ label: "+ Novo Lançamento", onClick: () => setEditando("novo") }}
        acoes={[
          { label: "Exportar planilha", icone: <Download className="icone" aria-hidden />, onClick: () => (filtrados.length ? baixarCsv(ordenados) : toast.erro("Nada para exportar.")) },
          // Lixeira (migração 047): lançamentos excluídos, recuperáveis por 30 dias — só administrador.
          ...(acesso?.admin ? [{ label: "Lixeira", onClick: () => setMostrarLixeira(true) }] : []),
        ]}
      />
      {mostrarLixeira && <Lixeira tipo="lancamentos" onFechar={() => setMostrarLixeira(false)} onRestaurado={carregar} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">A receber</p>
          <p className="mt-1 font-montserrat text-lg font-bold text-accent sm:text-xl">{formatarMoeda(totais.aReceber)}</p>
          <p className="text-xs text-gray-500">Recebido: {formatarMoeda(totais.recebido)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">A pagar</p>
          <p className="mt-1 font-montserrat text-lg font-bold text-status-error sm:text-xl">{formatarMoeda(totais.aPagar)}</p>
          <p className="text-xs text-gray-500">Pago: {formatarMoeda(totais.pago)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vencido</p>
          <p className={`mt-1 font-montserrat text-lg font-bold sm:text-xl ${vencido > 0 ? "text-status-error" : "text-gray-400"}`}>{formatarMoeda(vencido)}</p>
          <p className="text-xs text-gray-500">
            A receber: {formatarMoeda(totais.vencidoAReceber)} · a pagar: {formatarMoeda(totais.vencidoAPagar)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resultado das linhas filtradas</p>
          <p className={`mt-1 font-montserrat text-lg font-bold sm:text-xl ${totais.saldoPrevisto >= 0 ? "text-brand" : "text-status-error"}`}>
            {formatarMoeda(totais.saldoPrevisto)}
          </p>
          <p className="text-xs text-gray-500">Receitas menos despesas da lista abaixo — não é o saldo em conta</p>
        </div>
      </div>

      <PainelFiltros
        ativos={ativos}
        busca={
          <input
            aria-label="Buscar lançamento"
            className="input-field"
            placeholder="Buscar por descrição, obra, fornecedor ou parceiro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select aria-label="Período" className="input-field" value={periodo} onChange={(e) => filtrar("periodo", e.target.value)}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.label}
              </option>
            ))}
          </select>
          <select aria-label="Tipo" className="input-field" value={filtroTipo} onChange={(e) => filtrar("tipo", e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <select aria-label="Categoria" className="input-field" value={filtroCategoria} onChange={(e) => filtrar("categoria", e.target.value)}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
          <select aria-label="Situação" className="input-field" value={filtroSituacao} onChange={(e) => filtrar("situacao", e.target.value)}>
            <option value="">Todas as situações</option>
            {Object.entries(ROTULO_SITUACAO).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
          <select aria-label="Forma de pagamento" className="input-field" value={filtroForma} onChange={(e) => filtrar("forma", e.target.value)}>
            <option value="">Todas as formas de pagamento</option>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {LABEL_FORMA_PAGAMENTO[f]}
              </option>
            ))}
          </select>
        </div>
        {periodo === "personalizado" && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
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
          </div>
        )}
      </PainelFiltros>

      {erro && (
        <div className="card text-sm text-status-error">
          <p>{erro}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {carregando ? (
        <EsqueletoLista linhas={8} />
      ) : (
        !erro && (
          <>
            {/* Celular: cartão compacto — descrição e valor em cima, vencimento e situação embaixo; tocar abre para editar. */}
            <ul className="space-y-2 md:hidden">
              {visiveis.map((l) => {
                const situacao = situacaoLancamento(l, hoje);
                const ligado = vinculos(l);
                return (
                  <li key={l.id} className="card flex items-start gap-2 p-3">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditando(l)}>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 font-semibold text-gray-800">{l.descricao}</span>
                        <span className={`shrink-0 font-semibold ${l.tipo === "receita" ? "text-accent" : "text-status-error"}`}>
                          {l.tipo === "despesa" && "- "}
                          {formatarMoeda(l.valor)}
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{formatarData(l.data)}</span>
                        <span className={`badge ${CLASSE_SITUACAO[situacao]}`}>{labelSituacao(situacao, l.tipo)}</span>
                        <span>{l.categoria}</span>
                        {(l.anexos ?? []).length > 0 && (
                          <span>
                            <Paperclip className="icone" aria-hidden /> {(l.anexos ?? []).length}
                          </span>
                        )}
                      </span>
                      {ligado.length > 0 && <span className="mt-1 block truncate text-xs text-gray-500">{ligado.join(" · ")}</span>}
                    </button>
                    <MenuAcoes discreto acoes={acoesDe(l, situacao)} />
                  </li>
                );
              })}
              {filtrados.length === 0 && (
                <li className="card p-6 text-center text-sm text-gray-400">
                  {lancamentos.length === 0 ? "Nenhum lançamento neste período." : "Nenhum lançamento com esses filtros."}
                </li>
              )}
            </ul>

            <div className="card hidden overflow-x-auto p-0 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <Cabecalho campo="data">Vencimento</Cabecalho>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-left">Categoria</th>
                    <Cabecalho campo="descricao">Descrição</Cabecalho>
                    <Cabecalho campo="valor" direita>
                      Valor
                    </Cabecalho>
                    <Cabecalho campo="situacao">Situação</Cabecalho>
                    <th className="px-4 py-2 text-right">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visiveis.map((lancamento) => {
                    const situacao = situacaoLancamento(lancamento, hoje);
                    const ligado = vinculos(lancamento);
                    const totalAnexos = (lancamento.anexos ?? []).length;
                    return (
                      <tr key={lancamento.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setEditando(lancamento)}>
                        <td className="whitespace-nowrap px-4 py-2">{formatarData(lancamento.data)}</td>
                        <td className="px-4 py-2">
                          <span className={`badge ${lancamento.tipo === "receita" ? "bg-accent-light text-accent-dark" : "bg-red-100 text-status-error"}`}>
                            {lancamento.tipo === "receita" ? "Receita" : "Despesa"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-500">{lancamento.categoria}</td>
                        <td className="px-4 py-2">
                          <span className="block">
                            {lancamento.descricao}
                            {totalAnexos > 0 && (
                              <span className="ml-2 text-xs text-gray-500" title={`${totalAnexos} anexo(s)`}>
                                <Paperclip className="icone" aria-hidden /> {totalAnexos}
                              </span>
                            )}
                          </span>
                          {ligado.length > 0 && <span className="block text-xs text-gray-500">{ligado.join(" · ")}</span>}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-2 text-right font-medium ${lancamento.tipo === "receita" ? "text-accent" : "text-status-error"}`}>
                          {lancamento.tipo === "despesa" && "- "}
                          {formatarMoeda(lancamento.valor)}
                        </td>
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`badge whitespace-nowrap ${CLASSE_SITUACAO[situacao]}`}>{labelSituacao(situacao, lancamento.tipo)}</span>
                            {situacao !== "pago" && (
                              <button type="button" className="whitespace-nowrap py-1 text-xs font-semibold text-brand hover:underline" onClick={() => marcarPago(lancamento)}>
                                {lancamento.tipo === "receita" ? "Marcar recebido" : "Marcar pago"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                          <MenuAcoes discreto acoes={acoesDe(lancamento, situacao)} />
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

            {ordenados.length > limite && (
              <div className="flex flex-col items-center gap-1">
                <button type="button" className="btn-secondary" onClick={() => setLimite((n) => n + POR_VEZ)}>
                  Carregar mais ({ordenados.length - limite} restantes)
                </button>
                <span className="text-xs text-gray-400">
                  Mostrando {limite} de {ordenados.length}
                </span>
              </div>
            )}
          </>
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
