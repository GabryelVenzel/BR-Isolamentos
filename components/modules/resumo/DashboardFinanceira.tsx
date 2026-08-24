"use client";

import { useCallback, useEffect, useState } from "react";
import ReceitaDespesaChart from "@/components/modules/financeiro/graficos/ReceitaDespesaChart";
import DistribuicaoCategoriaChart from "@/components/modules/financeiro/graficos/DistribuicaoCategoriaChart";
import CustosFixosVariaveisChart from "@/components/modules/financeiro/graficos/CustosFixosVariaveisChart";
import { formatarMoeda, formatarNumero } from "@/lib/format";
import type {
  AlertaFinanceiro,
  CustosFixosVsVariaveis,
  DistribuicaoCategoria,
  KpisFinanceiro,
  ReceitaDespesaMes,
} from "@/lib/usecases/financeiro";
import type { CategoriaLancamento } from "@/lib/types/domain";

interface RelatorioFinanceiro {
  kpis: KpisFinanceiro;
  distribuicaoReceitas: DistribuicaoCategoria[];
  distribuicaoDespesas: DistribuicaoCategoria[];
  custosFixosVsVariaveis: CustosFixosVsVariaveis;
  receitaVsDespesaPorMes: ReceitaDespesaMes[];
  alertas: AlertaFinanceiro[];
}

/** Aba "Financeira" do dashboard centralizado de Resumo — antes vivia como
 * aba "Relatórios" dentro do próprio módulo Financeiro; movida pra cá pra
 * consolidar todos os relatórios num único lugar (ver decisão no topo de
 * app/resumo/page.tsx). Continua consumindo a mesma /api/financeiro/relatorios
 * — essa rota NÃO foi removida junto com a página, porque o Dashboard básico
 * que ficou em /financeiro (app/financeiro/page.tsx) também depende dela
 * (gráfico de receita/despesa + distribuição de despesas + alertas de
 * pendência). Os componentes de gráfico (ReceitaDespesaChart,
 * DistribuicaoCategoriaChart, CustosFixosVariaveisChart) continuam morando em
 * components/modules/financeiro/graficos pelo mesmo motivo — mover pra cá
 * quebraria o Dashboard do Financeiro, que não foi removido. */
export default function DashboardFinanceira() {
  const [relatorio, setRelatorio] = useState<RelatorioFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<"30dias" | "3meses" | "12meses">("12meses");
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([]);

  useEffect(() => {
    fetch("/api/financeiro/categorias")
      .then((r) => r.json())
      .then((p) => p.success && setCategorias(p.data));
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ periodo });
      if (categoria) params.set("categoria", categoria);

      const response = await fetch(`/api/financeiro/relatorios?${params.toString()}`);
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
  }, [periodo, categoria]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label-field">Período</label>
          <select className="input-field" value={periodo} onChange={(e) => setPeriodo(e.target.value as never)}>
            <option value="30dias">Últimos 30 dias</option>
            <option value="3meses">Últimos 3 meses</option>
            <option value="12meses">Últimos 12 meses</option>
          </select>
        </div>
        <div>
          <label className="label-field">Categoria</label>
          <select className="input-field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

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
              <p className="text-xs uppercase text-gray-500">Receita Total</p>
              <p className="font-montserrat text-2xl font-bold text-accent">{formatarMoeda(relatorio.kpis.receitaTotal)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Despesa Total</p>
              <p className="font-montserrat text-2xl font-bold text-status-error">{formatarMoeda(relatorio.kpis.despesaTotal)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Custos Fixos (mensal)</p>
              <p className="font-montserrat text-2xl font-bold text-brand">{formatarMoeda(relatorio.kpis.custosFixosMensal)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Margem</p>
              <p className="font-montserrat text-2xl font-bold text-brand">
                {relatorio.kpis.margemPercentual != null ? `${formatarNumero(relatorio.kpis.margemPercentual, 1)}%` : "—"}
              </p>
            </div>
          </div>

          <ReceitaDespesaChart dados={relatorio.receitaVsDespesaPorMes} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DistribuicaoCategoriaChart titulo="Distribuição de Receitas" dados={relatorio.distribuicaoReceitas} />
            <DistribuicaoCategoriaChart titulo="Distribuição de Despesas" dados={relatorio.distribuicaoDespesas} />
          </div>

          <CustosFixosVariaveisChart dados={relatorio.custosFixosVsVariaveis} />

          {relatorio.alertas.length > 0 && (
            <div className="card">
              <h3 className="mb-2 font-montserrat text-sm font-bold uppercase text-status-error">Pendências</h3>
              {relatorio.alertas.map((a) => (
                <p key={a.tipo} className="text-sm text-status-error">
                  {formatarMoeda(a.valor)} em {a.mensagem}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
