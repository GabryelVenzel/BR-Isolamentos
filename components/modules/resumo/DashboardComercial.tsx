"use client";

import { useCallback, useEffect, useState } from "react";
import FilterBar from "./FilterBar";
import ComissoesPorParceiroChart from "./graficos/ComissoesPorParceiroChart";
import { OrigemTabela, PipelineEtapaChart, VendasPorMesChart } from "./graficos/ComercialGraficos";
import { gerarPdfDeElemento, baixarArquivo } from "@/lib/pdf-generator";
import { formatarEtapa, formatarMoeda, formatarNumero } from "@/lib/format";
import type { FiltrosResumo } from "@/lib/types/resumo";
import type { RelatorioComercial } from "@/lib/usecases/comercial";
import { BadgePercent, Gift } from "lucide-react";
import Link from "next/link";
import { Carregando } from "@/components/ui/Esqueleto";

const FILTROS_INICIAIS: FiltrosResumo = { periodo: "mes_atual" };

/** Aba "Comercial" do dashboard centralizado de Resumo — antes vivia como
 * aba "Relatórios" dentro do próprio módulo Comercial; movida pra cá pra
 * consolidar todos os relatórios num único lugar (ver decisão no topo de
 * app/resumo/page.tsx). Continua consumindo a mesma /api/comercial/relatorios
 * — só a camada de apresentação mudou de módulo.
 *
 * Só o filtro de Período ficou aqui (Responsável e Temperatura, que existiam
 * antes, foram removidos por pedido — ver mesmo raciocínio em
 * DashboardOperacao.tsx). Pedido explícito (rodada "filtros por linhas"): usa
 * agora o MESMO FilterBar da aba Geral (Semana/Mês/Ano × Atual/Anterior +
 * Personalizado), em vez do `<select>` próprio que existia aqui antes. */
export default function DashboardComercial() {
  const [relatorio, setRelatorio] = useState<RelatorioComercial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosResumo>(FILTROS_INICIAIS);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ periodo: filtros.periodo });
      if (filtros.dataInicioCustom) params.set("dataInicio", filtros.dataInicioCustom);
      if (filtros.dataFimCustom) params.set("dataFim", filtros.dataFimCustom);

      const response = await fetch(`/api/comercial/relatorios?${params.toString()}`);
      const payload = await response.json();
      if (payload.success) {
        setRelatorio(payload.data);
      } else {
        setErro(payload.error ?? "Erro ao carregar o relatório.");
      }
    } catch {
      setErro("Erro de conexão ao carregar o relatório.");
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportarPdf() {
    setExportando(true);
    try {
      const blob = await gerarPdfDeElemento("resumo-comercial-export");
      baixarArquivo(blob, `Resumo_Comercial_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-6">
      <FilterBar filtros={filtros} onChange={setFiltros} onExportPdf={exportarPdf} onRefresh={carregar} atualizando={carregando || exportando} />

      {carregando ? (
        <Carregando linhas={6} />
      ) : erro || !relatorio ? (
        // Erro explícito em vez de "Carregando..." travado pra sempre —
        // importante logo após o deploy, antes de sql-migration-005 ser
        // aplicada no Supabase (tabelas novas ainda não existem).
        <div className="card text-sm text-status-error">
          <p>{erro ?? "Não foi possível carregar o relatório."}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <div id="resumo-comercial-export" className="space-y-6 bg-gray-50">
          {/* Indicadores (revisão do Resumo): resultado de vendas primeiro,
              depois eficiência (conversão, ticket, ciclo) e o que está em jogo. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Indicador titulo="Vendas fechadas" valor={formatarMoeda(relatorio.kpis.valorFechado)} detalhe={`${relatorio.kpis.quantidadeFechados} venda(s)`} cor="text-accent" />
            <Indicador titulo="Leads no período" valor={String(relatorio.kpis.totalLeads)} detalhe="Criados no período" />
            <Indicador titulo="Conversão" valor={`${formatarNumero(relatorio.kpis.taxaConversaoPercentual, 1)}%`} detalhe="Fechados / leads" />
            <Indicador titulo="Ticket médio" valor={formatarMoeda(relatorio.kpis.ticketMedio)} detalhe="Por venda fechada" />
            <Indicador
              titulo="Ciclo de venda"
              valor={relatorio.cicloVendaDias != null ? `${formatarNumero(relatorio.cicloVendaDias, 0)} dias` : "—"}
              detalhe="Da criação ao fechamento"
            />
            <Indicador titulo="Pipeline em aberto" valor={formatarMoeda(relatorio.kpis.valorEmPipeline)} detalhe="Leads ainda em andamento" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <VendasPorMesChart dados={relatorio.vendasPorMes} />
            <PipelineEtapaChart dados={relatorio.pipelinePorEtapa} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OrigemTabela dados={relatorio.leadsPorOrigem} />

            <div className="card">
              <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Tempo Médio por Etapa</h3>
              <ul className="space-y-2 text-sm">
                {relatorio.tempoMedioPorEtapa.map((t) => (
                  <li key={t.etapa} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                    <span>{formatarEtapa(t.etapa)}</span>
                    <span className="font-montserrat font-bold text-brand">{formatarNumero(t.diasMedio, 1)} dias</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Representantes (migração 055) — todos os leads de representante,
              independente do período: em andamento, fechados, comissão. */}
          {relatorio.representantes.length > 0 && (
            <div className="card overflow-x-auto p-0">
              <div className="px-4 pt-4">
                <h3 className="font-montserrat text-sm font-bold uppercase text-brand">
                  <BadgePercent className="icone" aria-hidden /> Representantes
                </h3>
                <p className="text-xs text-gray-500">
                  Todos os leads trazidos por representantes. Valores pela nossa proposta; a comissão é a devida sobre as vendas fechadas.
                </p>
              </div>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-2 text-left">Representante</th>
                    <th className="px-4 py-2 text-right">Em andamento</th>
                    <th className="px-4 py-2 text-right">Vendas fechadas</th>
                    <th className="px-4 py-2 text-right">Comissão</th>
                    <th className="px-4 py-2 text-right">Líquido</th>
                    <th className="px-4 py-2 text-right">Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {relatorio.representantes.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">
                        <Link href={`/comercial/representantes/${r.id}`} className="font-medium text-brand hover:underline">
                          {r.nome}
                        </Link>
                        <span className="block text-xs text-gray-400">{formatarNumero(r.percentualMedio, 1)}% em média</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {formatarMoeda(r.emAndamento.valor)} <span className="block text-xs text-gray-400">{r.emAndamento.quantidade} lead(s)</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {formatarMoeda(r.fechados.valor)} <span className="block text-xs text-gray-400">{r.fechados.quantidade} venda(s)</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-status-error">{formatarMoeda(r.fechados.comissao)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right font-semibold text-accent">{formatarMoeda(r.fechados.valor - r.fechados.comissao)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {formatarNumero(r.conversaoPercentual, 0)}% <span className="block text-xs text-gray-400">{r.perdidos} perdido(s)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="px-4 py-2">Total</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">{formatarMoeda(relatorio.representantes.reduce((s, r) => s + r.emAndamento.valor, 0))}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">{formatarMoeda(relatorio.representantes.reduce((s, r) => s + r.fechados.valor, 0))}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-status-error">{formatarMoeda(relatorio.representantes.reduce((s, r) => s + r.fechados.comissao, 0))}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-accent">
                      {formatarMoeda(relatorio.representantes.reduce((s, r) => s + r.fechados.valor - r.fechados.comissao, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Comissões (migração 026) — só aparece se houver algum lead de
              comissão no filtro atual, pra não poluir o dashboard de quem
              não usa a funcionalidade. */}
          {relatorio.comissoes.totalQuantidade > 0 && (
            <div className="space-y-4">
              <h2 className="font-montserrat text-sm font-bold uppercase text-brand"><Gift className="icone" aria-hidden /> Parcerias (indicações que nos pagam comissão)</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {relatorio.comissoes.porStatus.map((s) => (
                  <div key={s.status} className="card text-center">
                    <p className="text-xs uppercase text-gray-500">{s.label}</p>
                    <p className="font-montserrat text-xl font-bold text-brand">{s.quantidade}</p>
                    <p className="text-xs text-gray-500">{formatarMoeda(s.valorComissao)}</p>
                  </div>
                ))}
                <div className="card border-t-4 border-t-accent text-center">
                  <p className="text-xs uppercase text-gray-500">Total</p>
                  <p className="font-montserrat text-xl font-bold text-accent">{relatorio.comissoes.totalQuantidade}</p>
                  <p className="text-xs font-semibold text-gray-700">{formatarMoeda(relatorio.comissoes.totalValorComissao)}</p>
                </div>
              </div>
              <ComissoesPorParceiroChart dados={relatorio.comissoes.porParceiro} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">
                Leads dormindo ({relatorio.leadsDormindo.length})
              </h3>
              <p className="-mt-2 mb-3 text-xs text-gray-500">Em andamento e sem nenhuma atividade (contato, mudança de etapa ou de orçamento) há 7 dias ou mais.</p>
              {relatorio.leadsDormindo.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum lead esquecido — tudo em dia!</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {relatorio.leadsDormindo.slice(0, 8).map((lead) => (
                    <li key={lead.id} className="border-b border-gray-100 pb-2 last:border-0">
                      <Link href={`/comercial/leads/${lead.id}`} className="flex items-center justify-between gap-3 hover:underline">
                        <span className="min-w-0 truncate">
                          {lead.cliente?.nome ?? "—"} <span className="text-xs text-gray-400">· {formatarEtapa(lead.etapa)}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-status-error">
                          {lead.ultima_atividade ? `${Math.floor((Date.now() - new Date(lead.ultima_atividade).getTime()) / 86400000)} dias parado` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Leads Frios Agendados</h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="font-montserrat text-xl font-bold text-brand">{relatorio.leadsFriosResumo.total}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div>
                  <p className="font-montserrat text-xl font-bold text-status-error">{relatorio.leadsFriosResumo.reativandoHoje}</p>
                  <p className="text-xs text-gray-500">Reativando hoje</p>
                </div>
                <div>
                  <p className="font-montserrat text-xl font-bold text-secondary">{relatorio.leadsFriosResumo.proximos7Dias}</p>
                  <p className="text-xs text-gray-500">Próximos 7 dias</p>
                </div>
                <div>
                  <p className="font-montserrat text-xl font-bold text-gray-500">{relatorio.leadsFriosResumo.proximos30Dias}</p>
                  <p className="text-xs text-gray-500">Próximos 30 dias</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Indicador({ titulo, valor, detalhe, cor = "text-brand" }: { titulo: string; valor: string; detalhe?: string; cor?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 truncate font-montserrat text-lg font-bold sm:text-xl ${cor}`} title={valor}>
        {valor}
      </p>
      {detalhe && <p className="text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
}
