"use client";

import { formatarTemperatura } from "@/lib/format";
import PainelFiltros, { type FiltroAtivo } from "@/components/ui/PainelFiltros";
import { ORIGENS_LEAD, type TemperaturaLead } from "@/lib/types/domain";
import { BadgePercent, Gift } from "lucide-react";

export interface FiltrosKanbanState {
  busca: string;
  temperatura: TemperaturaLead | "";
  origem: string;
  atribuidoA: string;
  periodo: "" | "7dias" | "30dias" | "mes";
}

interface Usuario {
  email: string;
  nome: string;
}

interface Props {
  filtros: FiltrosKanbanState;
  onChange: (patch: Partial<FiltrosKanbanState>) => void;
  usuarios: Usuario[];
  mostrarFrios: boolean;
  onToggleFrios: (valor: boolean) => void;
  totalLeadsFrios: number;
  soAtrasados: boolean;
  onToggleAtrasados: (valor: boolean) => void;
  totalLeadsAtrasados: number;
  soComissoes: boolean;
  onToggleComissoes: (valor: boolean) => void;
  totalLeadsComissao: number;
  /** Migração 055: "" = todos; "todos" = só representações; id = um representante. */
  representante: string;
  onRepresentante: (valor: string) => void;
  representantes: Array<{ id: string; nome: string; total: number }>;
  mostrarPerdidos: boolean;
  onTogglePerdidos: (valor: boolean) => void;
  totalLeadsPerdidos: number;
}

const TEMPERATURAS: TemperaturaLead[] = ["quente", "morno", "frio"];

export default function FiltrosKanban({
  filtros,
  onChange,
  usuarios,
  mostrarFrios,
  onToggleFrios,
  totalLeadsFrios,
  soAtrasados,
  onToggleAtrasados,
  totalLeadsAtrasados,
  soComissoes,
  onToggleComissoes,
  totalLeadsComissao,
  representante,
  onRepresentante,
  representantes,
  mostrarPerdidos,
  onTogglePerdidos,
  totalLeadsPerdidos,
}: Props) {
  const PERIODOS: Record<string, string> = { "7dias": "Últimos 7 dias", "30dias": "Últimos 30 dias", mes: "Este mês" };
  const totalRepresentacoes = representantes.reduce((s, r) => s + r.total, 0);
  const ativos: FiltroAtivo[] = [
    ...(filtros.temperatura ? [{ label: formatarTemperatura(filtros.temperatura as TemperaturaLead), limpar: () => onChange({ temperatura: "" }) }] : []),
    ...(filtros.origem ? [{ label: filtros.origem, limpar: () => onChange({ origem: "" }) }] : []),
    ...(filtros.atribuidoA ? [{ label: usuarios.find((u) => u.email === filtros.atribuidoA)?.nome ?? filtros.atribuidoA, limpar: () => onChange({ atribuidoA: "" }) }] : []),
    ...(filtros.periodo ? [{ label: PERIODOS[filtros.periodo] ?? filtros.periodo, limpar: () => onChange({ periodo: "" }) }] : []),
    ...(mostrarFrios ? [{ label: "Leads frios em reativação", limpar: () => onToggleFrios(false) }] : []),
    ...(soAtrasados ? [{ label: "Só atrasados", limpar: () => onToggleAtrasados(false) }] : []),
    ...(soComissoes ? [{ label: "Só parcerias", limpar: () => onToggleComissoes(false) }] : []),
    ...(representante
      ? [
          {
            label: representante === "todos" ? "Só representações" : `Representante: ${representantes.find((r) => r.id === representante)?.nome ?? ""}`,
            limpar: () => onRepresentante(""),
          },
        ]
      : []),
    ...(mostrarPerdidos ? [{ label: "Com perdidos", limpar: () => onTogglePerdidos(false) }] : []),
  ];

  // Revisão de usabilidade: busca sempre visível; o resto recolhe no celular
  // (botão "Filtros") e os filtros ativos viram etiquetas removíveis.
  return (
    <PainelFiltros
      ativos={ativos}
      busca={
        <input
          className="input-field"
          aria-label="Buscar"
          placeholder="Buscar por código do lead (L00001), do orçamento (O00001) ou cliente..."
          value={filtros.busca}
          onChange={(e) => onChange({ busca: e.target.value })}
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select className="input-field" aria-label="Temperatura" value={filtros.temperatura} onChange={(e) => onChange({ temperatura: e.target.value as TemperaturaLead | "" })}>
          <option value="">Todas as temperaturas</option>
          {TEMPERATURAS.map((t) => (
            <option key={t} value={t}>
              {formatarTemperatura(t)}
            </option>
          ))}
        </select>
        <select className="input-field" aria-label="Origem" value={filtros.origem} onChange={(e) => onChange({ origem: e.target.value })}>
          <option value="">Todas as origens</option>
          {ORIGENS_LEAD.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select className="input-field" aria-label="Responsável" value={filtros.atribuidoA} onChange={(e) => onChange({ atribuidoA: e.target.value })}>
          <option value="">Todos os responsáveis</option>
          {usuarios.map((u) => (
            <option key={u.email} value={u.email}>
              {u.nome}
            </option>
          ))}
        </select>
        <select className="input-field" aria-label="Período" value={filtros.periodo} onChange={(e) => onChange({ periodo: e.target.value as FiltrosKanbanState["periodo"] })}>
          <option value="">Todo o período</option>
          <option value="7dias">Últimos 7 dias</option>
          <option value="30dias">Últimos 30 dias</option>
          <option value="mes">Este mês</option>
        </select>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 py-1 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4" checked={mostrarFrios} onChange={(e) => onToggleFrios(e.target.checked)} />
          Leads frios em reativação
          {totalLeadsFrios > 0 && <span className="badge bg-brand-light text-brand">{totalLeadsFrios}</span>}
        </label>
        <label className="flex items-center gap-2 py-1 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4" checked={soAtrasados} onChange={(e) => onToggleAtrasados(e.target.checked)} />
          Só atrasados
          {totalLeadsAtrasados > 0 && <span className="badge bg-red-100 text-status-error">{totalLeadsAtrasados}</span>}
        </label>
        <label className="flex items-center gap-2 py-1 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4" checked={soComissoes} onChange={(e) => onToggleComissoes(e.target.checked)} />
          <Gift className="icone" aria-hidden /> Só parcerias
          {totalLeadsComissao > 0 && <span className="badge bg-accent-light text-accent-dark">{totalLeadsComissao}</span>}
        </label>
        {/* Mesmo visual dos outros filtros; marcado, abre a lista para escolher um representante. */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 py-1 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4" checked={Boolean(representante)} onChange={(e) => onRepresentante(e.target.checked ? "todos" : "")} />
            <BadgePercent className="icone" aria-hidden /> Só representações
            {totalRepresentacoes > 0 && <span className="badge bg-purple-100 text-purple-800">{totalRepresentacoes}</span>}
          </label>
          {representante && representantes.length > 0 && (
            <select
              aria-label="Representante"
              className="rounded-input border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
              value={representante}
              onChange={(e) => onRepresentante(e.target.value)}
            >
              <option value="todos">Todos os representantes</option>
              {representantes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome} ({r.total})
                </option>
              ))}
            </select>
          )}
        </div>
        <label className="flex items-center gap-2 py-1 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4" checked={mostrarPerdidos} onChange={(e) => onTogglePerdidos(e.target.checked)} />
          Mostrar perdidos
          {totalLeadsPerdidos > 0 && <span className="badge bg-gray-100 text-gray-600">{totalLeadsPerdidos}</span>}
        </label>
      </div>
    </PainelFiltros>
  );
}
