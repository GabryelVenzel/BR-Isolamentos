"use client";

import { useEffect, useState } from "react";
import { formatarMoeda } from "@/lib/format";
import type { FiltrosResumo } from "@/lib/types/resumo";
import type { Dre, LinhaDre, ResultadoObra } from "@/lib/usecases/financeiro";

// Relatórios de resultado da aba Financeira do Resumo (migração 041):
// DRE simplificado por mês de competência e resultado por obra.

const LABEL_ETAPA: Record<ResultadoObra["etapa"], string> = { planejamento: "Planejamento", execucao: "Execução", finalizado: "Finalizado" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1]}/${ano.slice(2)}`;
}

function useRelatorio<T>(url: string): { dados: T | null; erro: string | null } {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    setErro(null);
    fetch(url)
      .then((r) => r.json())
      .then((p) => {
        if (cancelado) return;
        if (p.success) setDados(p.data);
        else setErro(p.error ?? "Não foi possível carregar o relatório.");
      })
      .catch(() => !cancelado && setErro("Erro de conexão ao carregar o relatório."));
    return () => {
      cancelado = true;
    };
  }, [url]);
  return { dados, erro };
}

function Linha({ linha, destaque, negativa, recuo }: { linha: LinhaDre; destaque?: boolean; negativa?: boolean; recuo?: boolean }) {
  const classeValor = (v: number) => (destaque && v < 0 ? "text-status-error" : "");
  const mostrar = (v: number) => (negativa && v !== 0 ? `(${formatarMoeda(v)})` : formatarMoeda(v));
  return (
    <tr className={destaque ? "bg-brand-light/60 font-semibold text-brand" : ""}>
      <th scope="row" className={`whitespace-nowrap px-4 py-2 text-left font-normal ${recuo ? "pl-8 text-gray-600" : ""} ${destaque ? "font-semibold" : ""}`}>
        {linha.rotulo}
      </th>
      {linha.valores.map((v, i) => (
        <td key={i} className={`whitespace-nowrap px-4 py-2 text-right ${classeValor(v)}`}>
          {mostrar(v)}
        </td>
      ))}
      <td className={`whitespace-nowrap px-4 py-2 text-right font-semibold ${classeValor(linha.total)}`}>{mostrar(linha.total)}</td>
    </tr>
  );
}

export function DreTabela({ filtros }: { filtros: FiltrosResumo }) {
  const params = new URLSearchParams({ periodo: filtros.periodo });
  if (filtros.dataInicioCustom) params.set("dataInicio", filtros.dataInicioCustom);
  if (filtros.dataFimCustom) params.set("dataFim", filtros.dataFimCustom);
  const { dados: dre, erro } = useRelatorio<Dre>(`/api/resumo/dre?${params.toString()}`);

  return (
    <div className="card p-0">
      <div className="p-6 pb-3">
        <h3 className="font-montserrat text-sm font-bold uppercase text-brand">DRE simplificado</h3>
        <p className="text-xs text-gray-500">
          Resultado por mês de competência (a que mês cada valor pertence, pago ou não). Para ver vários meses lado a lado, escolha o período &quot;Ano&quot;.
        </p>
      </div>
      {erro ? (
        <p className="px-6 pb-6 text-sm text-status-error">{erro}</p>
      ) : !dre ? (
        <p className="px-6 pb-6 text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Linha</th>
                {dre.meses.map((m) => (
                  <th key={m} className="px-4 py-2 text-right">
                    {rotuloMes(m)}
                  </th>
                ))}
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <Linha linha={dre.totalReceitas} destaque />
              {dre.receitas.map((l) => (
                <Linha key={`r-${l.rotulo}`} linha={l} recuo />
              ))}
              <Linha linha={{ ...dre.totalCustosVariaveis, rotulo: "(−) Custos variáveis" }} negativa />
              {dre.custosVariaveis.map((l) => (
                <Linha key={`v-${l.rotulo}`} linha={l} recuo negativa />
              ))}
              <Linha linha={{ ...dre.margemContribuicao, rotulo: "= Margem de contribuição" }} destaque />
              <Linha linha={{ ...dre.custosFixos, rotulo: "(−) Custos fixos" }} negativa />
              <Linha linha={{ ...dre.resultado, rotulo: "= Resultado" }} destaque />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ResultadoObrasTabela() {
  const { dados: obras, erro } = useRelatorio<ResultadoObra[]>("/api/resumo/resultado-obras");

  return (
    <div className="card p-0">
      <div className="p-6 pb-3">
        <h3 className="font-montserrat text-sm font-bold uppercase text-brand">Resultado por obra</h3>
        <p className="text-xs text-gray-500">
          Orçado contra o que foi lançado em cada obra. Só entram lançamentos ligados à obra (campo &quot;Obra&quot; do lançamento).
        </p>
      </div>
      {erro ? (
        <p className="px-6 pb-6 text-sm text-status-error">{erro}</p>
      ) : !obras ? (
        <p className="px-6 pb-6 text-sm text-gray-500">Carregando...</p>
      ) : obras.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-gray-400">Nenhuma obra cadastrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabela-cartoes w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Obra</th>
                <th className="px-4 py-2 text-left">Etapa</th>
                <th className="px-4 py-2 text-right">Orçado</th>
                <th className="px-4 py-2 text-right">Receita</th>
                <th className="px-4 py-2 text-right">Recebido</th>
                <th className="px-4 py-2 text-right">Despesa</th>
                <th className="px-4 py-2 text-right">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {obras.map((o) => (
                <tr key={o.servicoId}>
                  <td data-label="Obra" className="px-4 py-2">
                    <span className="font-semibold text-brand">{o.numero}</span>
                    {o.cliente && <span className="text-gray-600"> · {o.cliente}</span>}
                  </td>
                  <td data-label="Etapa" className="px-4 py-2 text-gray-500">
                    {LABEL_ETAPA[o.etapa]}
                  </td>
                  <td data-label="Orçado" className="whitespace-nowrap px-4 py-2 text-right">
                    {formatarMoeda(o.orcado)}
                  </td>
                  <td data-label="Receita" className="whitespace-nowrap px-4 py-2 text-right">
                    {formatarMoeda(o.receita)}
                  </td>
                  <td data-label="Recebido" className="whitespace-nowrap px-4 py-2 text-right text-accent">
                    {formatarMoeda(o.recebido)}
                  </td>
                  <td data-label="Despesa" className="whitespace-nowrap px-4 py-2 text-right text-status-error">
                    {formatarMoeda(o.despesa)}
                    {o.consumoDoOrcadoPercentual !== null && (
                      <span className="block text-xs text-gray-500">{o.consumoDoOrcadoPercentual.toFixed(0)}% do orçado</span>
                    )}
                  </td>
                  <td data-label="Margem" className={`whitespace-nowrap px-4 py-2 text-right font-semibold ${o.margem >= 0 ? "text-brand" : "text-status-error"}`}>
                    {formatarMoeda(o.margem)}
                    {o.margemPercentual !== null && <span className="block text-xs font-normal text-gray-500">{o.margemPercentual.toFixed(1)}%</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
