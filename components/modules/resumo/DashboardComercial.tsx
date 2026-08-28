"use client";

import { useCallback, useEffect, useState } from "react";
import ComissoesPorParceiroChart from "./graficos/ComissoesPorParceiroChart";
import FunilChart from "./graficos/FunilChart";
import OrigemChart from "./graficos/OrigemChart";
import ResponsavelChart from "./graficos/ResponsavelChart";
import { gerarPdfDeElemento, baixarArquivo } from "@/lib/pdf-generator";
import { formatarEtapa, formatarMoeda, formatarNumero } from "@/lib/format";
import type { RelatorioComercial } from "@/lib/usecases/comercial";

/** Aba "Comercial" do dashboard centralizado de Resumo — antes vivia como
 * aba "Relatórios" dentro do próprio módulo Comercial; movida pra cá pra
 * consolidar todos os relatórios num único lugar (ver decisão no topo de
 * app/resumo/page.tsx). Continua consumindo a mesma /api/comercial/relatorios
 * — só a camada de apresentação mudou de módulo.
 *
 * Só o filtro de Período ficou aqui (Responsável e Temperatura, que existiam
 * antes, foram removidos por pedido — ver mesmo raciocínio em
 * DashboardOperacao.tsx). */
export default function DashboardComercial() {
  const [relatorio, setRelatorio] = useState<RelatorioComercial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<"" | "7dias" | "30dias" | "mes">("");
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (periodo) params.set("periodo", periodo);

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
  }, [periodo]);

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
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label-field">Período</label>
          <select className="input-field" value={periodo} onChange={(e) => setPeriodo(e.target.value as never)}>
            <option value="">Todo período</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="mes">Este mês</option>
          </select>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <button type="button" className="btn-secondary" onClick={exportarPdf} disabled={exportando || !relatorio}>
            {exportando ? "Gerando..." : "📥 Exportar"}
          </button>
          <button type="button" className="btn-primary" onClick={carregar} disabled={carregando}>
            {carregando ? "Atualizando..." : "🔄 Atualizar"}
          </button>
        </div>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando relatório...</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Total de Leads</p>
              <p className="font-montserrat text-2xl font-bold text-brand">{relatorio.kpis.totalLeads}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Taxa de Conversão</p>
              <p className="font-montserrat text-2xl font-bold text-accent">{formatarNumero(relatorio.kpis.taxaConversaoPercentual, 1)}%</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Valor em Pipeline</p>
              <p className="font-montserrat text-2xl font-bold text-brand">{formatarMoeda(relatorio.kpis.valorEmPipeline)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Ticket Médio</p>
              <p className="font-montserrat text-2xl font-bold text-brand">{formatarMoeda(relatorio.kpis.ticketMedio)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FunilChart funil={relatorio.funil} />

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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OrigemChart dados={relatorio.leadsPorOrigem} />
            <ResponsavelChart dados={relatorio.performancePorResponsavel} />
          </div>

          {/* Comissões (migração 026) — só aparece se houver algum lead de
              comissão no filtro atual, pra não poluir o dashboard de quem
              não usa a funcionalidade. */}
          {relatorio.comissoes.totalQuantidade > 0 && (
            <div className="space-y-4">
              <h2 className="font-montserrat text-sm font-bold uppercase text-brand">🎁 Comissões (Indicações)</h2>
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
                Leads Dormindo ({relatorio.leadsDormindo.length})
              </h3>
              {relatorio.leadsDormindo.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum lead esquecido — tudo em dia!</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {relatorio.leadsDormindo.slice(0, 8).map((lead) => (
                    <li key={lead.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                      <span>{lead.cliente?.nome ?? "—"}</span>
                      <span className="text-xs text-status-error">{formatarEtapa(lead.etapa)}</span>
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
