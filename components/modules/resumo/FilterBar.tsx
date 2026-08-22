"use client";

import { useEffect, useState } from "react";
import type { FiltrosResumo, Periodo, TipoTrabalhoFiltro } from "@/lib/types/resumo";

interface Usuario {
  id: string;
  email: string;
  nome: string;
}

interface Props {
  filtros: FiltrosResumo;
  onChange: (filtros: FiltrosResumo) => void;
  onExportPdf: () => void;
  onExportCsv: () => void;
  onRefresh: () => void;
  atualizando?: boolean;
}

const PERIODOS: Array<{ value: Periodo; label: string }> = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "mes", label: "Este mês" },
  { value: "ano", label: "Este ano" },
  { value: "tudo", label: "Todo período" },
];

/** Filtros globais do dashboard executivo (módulo Resumo). Cada mudança já
 * dispara `onChange` — a página (app/resumo/page.tsx) é quem decide como/
 * quando refazer as chamadas de API a partir do novo `filtros`. */
export default function FilterBar({ filtros, onChange, onExportPdf, onExportCsv, onRefresh, atualizando }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [mostrarExport, setMostrarExport] = useState(false);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setUsuarios(data))
      .catch(() => setUsuarios([]));
  }, []);

  return (
    <div className="card flex flex-wrap items-end gap-3">
      <div>
        <label className="label-field">Período</label>
        <select
          className="input-field"
          value={filtros.periodo}
          onChange={(e) => onChange({ ...filtros, periodo: e.target.value as Periodo })}
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label-field">Tipo</label>
        <select
          className="input-field"
          value={filtros.tipoTrabalho ?? ""}
          onChange={(e) =>
            onChange({ ...filtros, tipoTrabalho: (e.target.value || undefined) as TipoTrabalhoFiltro | undefined })
          }
        >
          <option value="">Todos</option>
          <option value="quente">Quente</option>
          <option value="frio">Frio</option>
          <option value="misto">Misto</option>
        </select>
      </div>

      <div>
        <label className="label-field">Responsável</label>
        <select
          className="input-field"
          value={filtros.responsavel ?? ""}
          onChange={(e) => onChange({ ...filtros, responsavel: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.email}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-end gap-2">
        <div className="relative">
          <button type="button" className="btn-secondary" onClick={() => setMostrarExport((v) => !v)}>
            Exportar ▾
          </button>
          {mostrarExport && (
            <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-card border border-gray-200 bg-white shadow-card-hover">
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => {
                  setMostrarExport(false);
                  onExportPdf();
                }}
              >
                Download PDF
              </button>
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => {
                  setMostrarExport(false);
                  onExportCsv();
                }}
              >
                Download CSV
              </button>
            </div>
          )}
        </div>
        <button type="button" className="btn-primary" onClick={onRefresh} disabled={atualizando}>
          {atualizando ? "Atualizando..." : "↻ Atualizar"}
        </button>
      </div>
    </div>
  );
}
