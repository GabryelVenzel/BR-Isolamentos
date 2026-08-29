"use client";

import { useCallback, useEffect, useState } from "react";
import FunilServicosChart from "./graficos/FunilServicosChart";
import CustoRealOrcadoChart from "./graficos/CustoRealOrcadoChart";
import { TIPOS_TRABALHO_OPCOES } from "@/components/modules/operacional/MultiSelectTiposTrabalho";
import { gerarPdfDeElemento, baixarArquivo } from "@/lib/pdf-generator";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type { RelatorioOperacional } from "@/lib/usecases/operacional";

// Lista revisada (migração 027) — reaproveita a mesma fonte de sempre, ver
// MultiSelectTiposTrabalho.tsx.
const LABEL_TIPO: Record<string, string> = Object.fromEntries(TIPOS_TRABALHO_OPCOES.map((o) => [o.valor, o.label]));

/** Aba "Operação" do dashboard centralizado de Resumo — antes vivia como
 * aba "Relatórios" dentro do próprio módulo Operacional; movida pra cá pra
 * consolidar todos os relatórios num único lugar (ver decisão no topo de
 * app/resumo/page.tsx). Continua consumindo a mesma /api/operacional/relatorios
 * — só a camada de apresentação mudou de módulo.
 *
 * Só o filtro de Período ficou aqui (Tipo de Trabalho e Responsável, que
 * existiam antes, foram removidos por pedido — o Resumo é visão executiva
 * rápida; quem quiser esse recorte detalhado usa a aba Relatórios dentro do
 * próprio módulo Operacional). "Este ano"/"Personalizado" não foram
 * adicionados aqui como no filtro de Período da aba Geral — exigiriam
 * estender `/api/operacional/relatorios`, que só aceita 7dias/30dias/mes/
 * todos hoje; fora do escopo desta rodada de padronização visual. */
export default function DashboardOperacao() {
  const [relatorio, setRelatorio] = useState<RelatorioOperacional | null>(null);
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

      const response = await fetch(`/api/operacional/relatorios?${params.toString()}`);
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
      const blob = await gerarPdfDeElemento("resumo-operacao-export");
      baixarArquivo(blob, `Resumo_Operacao_${new Date().toISOString().slice(0, 10)}.pdf`);
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

      <div id="resumo-operacao-export" className="space-y-6 bg-gray-50">
      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : erro || !relatorio ? (
        <div className="card text-sm text-status-error">
          <p>{erro ?? "Não foi possível carregar o relatório."}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Concluídos</p>
              <p className="font-montserrat text-2xl font-bold text-accent">{relatorio.kpis.servicosConcluidos}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Taxa de Conclusão</p>
              <p className="font-montserrat text-2xl font-bold text-brand">{formatarNumero(relatorio.kpis.taxaConclusaoPercentual, 0)}%</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Tempo Médio Execução</p>
              <p className="font-montserrat text-2xl font-bold text-brand">{formatarNumero(relatorio.kpis.tempoMedioExecucaoDias, 1)} dias</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Custo Real vs Orçado</p>
              <p className="font-montserrat text-2xl font-bold text-brand">
                {relatorio.kpis.custoRealVsOrcadoPercentual != null ? `${formatarNumero(relatorio.kpis.custoRealVsOrcadoPercentual, 0)}%` : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Planejados</p>
              <p className="font-montserrat text-xl font-bold text-brand">{relatorio.kpis.servicosPlanejados}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Em Execução</p>
              <p className="font-montserrat text-xl font-bold text-accent">{relatorio.kpis.servicosEmProgresso}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Vencidos</p>
              <p className="font-montserrat text-xl font-bold text-status-error">{relatorio.servicosVencidos.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FunilServicosChart funil={relatorio.funil} />

            <div className="card">
              <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Tempo de Execução por Tipo</h3>
              {relatorio.tempoExecucaoPorTipo.length === 0 ? (
                <p className="text-sm text-gray-400">Sem serviços finalizados no período.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {relatorio.tempoExecucaoPorTipo.map((t) => (
                    <li key={t.tipoTrabalho} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                      <span>{LABEL_TIPO[t.tipoTrabalho] ?? t.tipoTrabalho}</span>
                      <span className="font-montserrat font-bold text-brand">
                        {formatarNumero(t.diasRealizado, 1)} dias realizado
                        {t.diasOrcado != null && <span className="text-gray-400"> (vs {formatarNumero(t.diasOrcado, 1)} orçado)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <CustoRealOrcadoChart dados={relatorio.custoRealVsOrcado} />

          <div className="card">
            <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">
              Serviços Vencidos ({relatorio.servicosVencidos.length})
            </h3>
            {relatorio.servicosVencidos.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum serviço vencido — tudo em dia!</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {relatorio.servicosVencidos.map(({ servico, diasAtraso }) => (
                  <li key={servico.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                    <span>
                      {servico.numero_servico} — {servico.cliente?.nome ?? "—"}
                    </span>
                    <span className="font-montserrat font-bold text-status-error">{diasAtraso}d atrasado</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {relatorio.kpis.custoRealVsOrcadoPercentual != null && (
            <p className="text-xs text-gray-400">
              Total: {formatarMoeda(relatorio.custoRealVsOrcado.totalOrcado)} orçado vs{" "}
              {formatarMoeda(relatorio.custoRealVsOrcado.totalReal)} real
            </p>
          )}
        </>
      )}
      </div>
    </div>
  );
}
