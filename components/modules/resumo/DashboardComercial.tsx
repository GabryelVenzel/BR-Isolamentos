"use client";

import { useCallback, useEffect, useState } from "react";
import FunilChart from "./graficos/FunilChart";
import OrigemChart from "./graficos/OrigemChart";
import ResponsavelChart from "./graficos/ResponsavelChart";
import { formatarEtapa, formatarMoeda, formatarNumero } from "@/lib/format";
import type { RelatorioComercial } from "@/lib/usecases/comercial";

interface Usuario {
  email: string;
  nome: string;
}

/** Aba "Comercial" do dashboard centralizado de Resumo — antes vivia como
 * aba "Relatórios" dentro do próprio módulo Comercial; movida pra cá pra
 * consolidar todos os relatórios num único lugar (ver decisão no topo de
 * app/resumo/page.tsx). Continua consumindo a mesma /api/comercial/relatorios
 * — só a camada de apresentação mudou de módulo. */
export default function DashboardComercial() {
  const [relatorio, setRelatorio] = useState<RelatorioComercial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [periodo, setPeriodo] = useState<"" | "7dias" | "30dias" | "mes">("");
  const [atribuidoA, setAtribuidoA] = useState("");
  const [temperatura, setTemperatura] = useState("");

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (periodo) params.set("periodo", periodo);
      if (atribuidoA) params.set("atribuido_a", atribuidoA);
      if (temperatura) params.set("temperatura", temperatura);

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
  }, [periodo, atribuidoA, temperatura]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) {
    return <p className="text-sm text-gray-500">Carregando relatório...</p>;
  }

  // Erro explícito em vez de "Carregando..." travado pra sempre — importante
  // sobretudo logo após o deploy desta funcionalidade, antes de
  // sql-migration-005-crm-avancado.sql ser aplicada no Supabase (as tabelas
  // novas ainda não existem e a API responde erro, não sucesso vazio).
  if (erro || !relatorio) {
    return (
      <div className="card text-sm text-status-error">
        <p>{erro ?? "Não foi possível carregar o relatório."}</p>
        <button type="button" className="btn-secondary mt-3" onClick={carregar}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const { kpis, funil, tempoMedioPorEtapa, leadsPorOrigem, performancePorResponsavel, leadsDormindo, leadsFriosResumo } = relatorio;

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label-field">Período</label>
          <select className="input-field" value={periodo} onChange={(e) => setPeriodo(e.target.value as never)}>
            <option value="">Todo período</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="mes">Este mês</option>
          </select>
        </div>
        <div>
          <label className="label-field">Responsável</label>
          <select className="input-field" value={atribuidoA} onChange={(e) => setAtribuidoA(e.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.email} value={u.email}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Temperatura</label>
          <select className="input-field" value={temperatura} onChange={(e) => setTemperatura(e.target.value)}>
            <option value="">Todas</option>
            <option value="quente">Quente</option>
            <option value="morno">Morno</option>
            <option value="frio">Frio</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card text-center">
          <p className="text-xs uppercase text-gray-500">Total de Leads</p>
          <p className="font-montserrat text-2xl font-bold text-brand">{kpis.totalLeads}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase text-gray-500">Taxa de Conversão</p>
          <p className="font-montserrat text-2xl font-bold text-accent">{formatarNumero(kpis.taxaConversaoPercentual, 1)}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase text-gray-500">Valor em Pipeline</p>
          <p className="font-montserrat text-2xl font-bold text-brand">{formatarMoeda(kpis.valorEmPipeline)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs uppercase text-gray-500">Ticket Médio</p>
          <p className="font-montserrat text-2xl font-bold text-brand">{formatarMoeda(kpis.ticketMedio)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunilChart funil={funil} />

        <div className="card">
          <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">Tempo Médio por Etapa</h3>
          <ul className="space-y-2 text-sm">
            {tempoMedioPorEtapa.map((t) => (
              <li key={t.etapa} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                <span>{formatarEtapa(t.etapa)}</span>
                <span className="font-montserrat font-bold text-brand">{formatarNumero(t.diasMedio, 1)} dias</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OrigemChart dados={leadsPorOrigem} />
        <ResponsavelChart dados={performancePorResponsavel} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-montserrat text-sm font-bold uppercase text-brand">
            Leads Dormindo ({leadsDormindo.length})
          </h3>
          {leadsDormindo.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum lead esquecido — tudo em dia!</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {leadsDormindo.slice(0, 8).map((lead) => (
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
              <p className="font-montserrat text-xl font-bold text-brand">{leadsFriosResumo.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div>
              <p className="font-montserrat text-xl font-bold text-status-error">{leadsFriosResumo.reativandoHoje}</p>
              <p className="text-xs text-gray-500">Reativando hoje</p>
            </div>
            <div>
              <p className="font-montserrat text-xl font-bold text-secondary">{leadsFriosResumo.proximos7Dias}</p>
              <p className="text-xs text-gray-500">Próximos 7 dias</p>
            </div>
            <div>
              <p className="font-montserrat text-xl font-bold text-gray-500">{leadsFriosResumo.proximos30Dias}</p>
              <p className="text-xs text-gray-500">Próximos 30 dias</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
