"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import MenuAcoes from "@/components/ui/MenuAcoes";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import { EsqueletoLista } from "@/components/ui/Esqueleto";
import { confirmar } from "@/components/ui/confirmar";
import { toast } from "@/components/modules/financeiro/toast";
import { hojeBrasilia } from "@/lib/financeiro";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { CategoriaLancamento, ProjecaoFinanceira, TipoLancamentoFinanceiro } from "@/lib/types/domain";

/** Financeiro → Projeção (migração 054): lançamentos PREVISTOS
 * simplificados — tipo, categoria, descrição, valor e vencimento. Entram no
 * fluxo de caixa (por mês e D+90) e nos indicadores financeiros do Resumo,
 * mas não em Lançamentos nem no resultado por obra. Depois do vencimento
 * deixam de contar e somem desta lista sozinhos. */
export default function ProjecaoPage() {
  const [projecoes, setProjecoes] = useState<ProjecaoFinanceira[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([]);
  const [editando, setEditando] = useState<ProjecaoFinanceira | "nova" | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/financeiro/projecoes").then((x) => x.json()).catch(() => null);
    if (r?.success) setProjecoes(r.data);
    else {
      setProjecoes([]);
      toast.erro(r?.error ?? "Não foi possível carregar as projeções.");
    }
  }, []);

  useEffect(() => {
    carregar();
    fetch("/api/financeiro/categorias")
      .then((x) => x.json())
      .then((p) => p.success && setCategorias(p.data));
  }, [carregar]);

  async function excluir(p: ProjecaoFinanceira) {
    if (!(await confirmar(`Apagar a projeção "${p.descricao}" de ${formatarData(p.data)}?`, { confirmarLabel: "Apagar" }))) return;
    const r = await fetch(`/api/financeiro/projecoes/${p.id}`, { method: "DELETE" }).then((x) => x.json());
    if (!r.success) return toast.erro(r.error ?? "Não foi possível apagar.");
    toast.sucesso("Projeção apagada.");
    carregar();
  }

  const totais = useMemo(() => {
    const lista = projecoes ?? [];
    const receitas = lista.filter((p) => p.tipo === "receita").reduce((s, p) => s + Number(p.valor), 0);
    const despesas = lista.filter((p) => p.tipo === "despesa").reduce((s, p) => s + Number(p.valor), 0);
    return { receitas, despesas, saldo: receitas - despesas };
  }, [projecoes]);

  const acoesDe = (p: ProjecaoFinanceira) => [
    { label: "Editar", icone: <Pencil className="icone" aria-hidden />, onClick: () => setEditando(p) },
    { label: "Apagar", icone: <Trash2 className="icone" aria-hidden />, perigo: true, onClick: () => excluir(p) },
  ];

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Projeção"
        descricao="Entradas e saídas previstas, sem lançar no Financeiro: entram no fluxo de caixa e nos indicadores do Resumo até o vencimento e depois somem sozinhas. Não entram em Lançamentos nem no resultado por obra."
        acaoPrincipal={{ label: "+ Nova projeção", onClick: () => setEditando("nova") }}
      />

      <div className="grid grid-cols-3 gap-3">
        <Total titulo="Entradas previstas" valor={totais.receitas} cor="text-accent" />
        <Total titulo="Saídas previstas" valor={totais.despesas} cor="text-status-error" />
        <Total titulo="Saldo das projeções" valor={totais.saldo} cor={totais.saldo < 0 ? "text-status-error" : "text-brand"} />
      </div>

      {projecoes === null ? (
        <EsqueletoLista linhas={5} />
      ) : (
        <>
          {/* Celular: cartões */}
          <ul className="space-y-2 md:hidden">
            {projecoes.map((p) => (
              <li key={p.id} className="card flex items-start gap-2 p-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditando(p)}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 font-semibold text-gray-800">{p.descricao}</span>
                    <span className={`shrink-0 font-semibold ${p.tipo === "receita" ? "text-accent" : "text-status-error"}`}>
                      {p.tipo === "despesa" && "- "}
                      {formatarMoeda(Number(p.valor))}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {formatarData(p.data)} · {p.categoria}
                  </span>
                </button>
                <MenuAcoes discreto acoes={acoesDe(p)} />
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-2 text-left">Vencimento</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-left">Categoria</th>
                  <th className="px-4 py-2 text-left">Descrição</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projecoes.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setEditando(p)}>
                    <td className="whitespace-nowrap px-4 py-2">{formatarData(p.data)}</td>
                    <td className="px-4 py-2">
                      <span className={`badge ${p.tipo === "receita" ? "bg-accent-light text-accent-dark" : "bg-red-100 text-status-error"}`}>
                        {p.tipo === "receita" ? "Receita" : "Despesa"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{p.categoria}</td>
                    <td className="px-4 py-2">{p.descricao}</td>
                    <td className={`whitespace-nowrap px-4 py-2 text-right font-medium ${p.tipo === "receita" ? "text-accent" : "text-status-error"}`}>
                      {p.tipo === "despesa" && "- "}
                      {formatarMoeda(Number(p.valor))}
                    </td>
                    <td className="px-2 py-1 text-right" onClick={(e) => e.stopPropagation()}>
                      <MenuAcoes discreto acoes={acoesDe(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {projecoes.length === 0 && (
            <p className="card p-6 text-center text-sm text-gray-400">Nenhuma projeção vigente. Use &quot;+ Nova projeção&quot; para planejar uma entrada ou saída.</p>
          )}
        </>
      )}

      {editando && (
        <ModalProjecao
          projecao={editando === "nova" ? null : editando}
          categorias={categorias}
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

function Total({ titulo, valor, cor }: { titulo: string; valor: number; cor: string }) {
  return (
    <div className="card p-3 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 truncate font-montserrat text-base font-bold sm:text-xl ${cor}`}>{formatarMoeda(valor)}</p>
    </div>
  );
}

function ModalProjecao({
  projecao,
  categorias,
  onFechar,
  onSalvo,
}: {
  projecao: ProjecaoFinanceira | null;
  categorias: CategoriaLancamento[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamentoFinanceiro>(projecao?.tipo ?? "despesa");
  const [categoria, setCategoria] = useState(projecao?.categoria ?? "");
  const [descricao, setDescricao] = useState(projecao?.descricao ?? "");
  const [valor, setValor] = useState(projecao ? String(projecao.valor) : "");
  const [data, setData] = useState(projecao?.data ?? hojeBrasilia());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = categorias.filter((c) => c.tipo === tipo && (c.ativo || c.nome === categoria));

  async function salvar() {
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!categoria) return setErro("Escolha a categoria.");
    if (!(Number(valor) > 0)) return setErro("Informe o valor.");
    if (!data) return setErro("Informe o vencimento.");
    if (data < hojeBrasilia()) return setErro("O vencimento não pode ser no passado — projeção vencida não conta mais.");
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch(projecao ? `/api/financeiro/projecoes/${projecao.id}` : "/api/financeiro/projecoes", {
        method: projecao ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, categoria, descricao: descricao.trim(), valor: Number(valor), data }),
      }).then((x) => x.json());
      if (!r.success) return setErro(r.error ?? "Não foi possível salvar.");
      toast.sucesso(projecao ? "Projeção atualizada." : "Projeção criada.");
      onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-fundo z-50">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-projecao" className="modal-caixa sm:max-w-md">
        <h2 id="titulo-projecao" className="mb-4 font-montserrat text-lg font-bold text-brand">
          {projecao ? "Editar projeção" : "Nova projeção"}
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["receita", "despesa"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tipo === t}
                className={tipo === t ? (t === "receita" ? "btn-accent" : "btn-danger") : "btn-secondary"}
                onClick={() => {
                  setTipo(t);
                  setCategoria("");
                }}
              >
                {t === "receita" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>
          <div>
            <label className="label-field" htmlFor="proj-descricao">
              Descrição<span className="text-status-error"> *</span>
            </label>
            <input id="proj-descricao" className="input-field" placeholder="Ex.: 2ª parcela da obra X" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <label className="label-field" htmlFor="proj-categoria">
              Categoria<span className="text-status-error"> *</span>
            </label>
            <select id="proj-categoria" className="input-field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Escolha...</option>
              {opcoes.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="proj-valor">
                Valor<span className="text-status-error"> *</span>
              </label>
              <CampoMoeda id="proj-valor" value={valor} onChange={setValor} />
            </div>
            <div>
              <label className="label-field" htmlFor="proj-data">
                Vencimento<span className="text-status-error"> *</span>
              </label>
              <input id="proj-data" type="date" min={hojeBrasilia()} className="input-field" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          {erro && (
            <p role="alert" className="text-sm text-status-error">
              {erro}
            </p>
          )}
        </div>
        <div className="rodape-modal flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onFechar}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
