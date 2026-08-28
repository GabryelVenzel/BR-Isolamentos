"use client";

import { formatarTemperatura } from "@/lib/format";
import { ORIGENS_LEAD, type TemperaturaLead } from "@/lib/types/domain";

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
}: Props) {
  return (
    <div className="card space-y-3">
      <div>
        <label className="label-field">Buscar</label>
        <input
          className="input-field"
          placeholder="Código do lead (L00001), código do orçamento (O00001) ou cliente..."
          value={filtros.busca}
          onChange={(e) => onChange({ busca: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label-field">Temperatura</label>
          <select
            className="input-field"
            value={filtros.temperatura}
            onChange={(e) => onChange({ temperatura: e.target.value as TemperaturaLead | "" })}
          >
            <option value="">Todas</option>
            {TEMPERATURAS.map((t) => (
              <option key={t} value={t}>
                {formatarTemperatura(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Origem</label>
          <select className="input-field" value={filtros.origem} onChange={(e) => onChange({ origem: e.target.value })}>
            <option value="">Todas as origens</option>
            {ORIGENS_LEAD.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Responsável</label>
          <select className="input-field" value={filtros.atribuidoA} onChange={(e) => onChange({ atribuidoA: e.target.value })}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.email} value={u.email}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Período</label>
          <select
            className="input-field"
            value={filtros.periodo}
            onChange={(e) => onChange({ periodo: e.target.value as FiltrosKanbanState["periodo"] })}
          >
            <option value="">Todo período</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="mes">Este mês</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 pt-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={mostrarFrios} onChange={(e) => onToggleFrios(e.target.checked)} />
          Mostrar leads frios em reativação
          {totalLeadsFrios > 0 && <span className="badge bg-brand-light text-brand">{totalLeadsFrios}</span>}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={soAtrasados} onChange={(e) => onToggleAtrasados(e.target.checked)} />
          Mostrar só leads atrasados
          {totalLeadsAtrasados > 0 && <span className="badge bg-red-100 text-status-error">{totalLeadsAtrasados}</span>}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={soComissoes} onChange={(e) => onToggleComissoes(e.target.checked)} />
          🎁 Mostrar só comissões
          {totalLeadsComissao > 0 && <span className="badge bg-accent-light text-accent-dark">{totalLeadsComissao}</span>}
        </label>
      </div>
    </div>
  );
}
