"use client";

import { useState } from "react";
import type { FiltrosResumo, Periodo } from "@/lib/types/resumo";

interface Props {
  filtros: FiltrosResumo;
  onChange: (filtros: FiltrosResumo) => void;
  onExportPdf: () => void;
  onExportCsv?: () => void;
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
  { value: "custom", label: "Personalizado..." },
];

/** Filtro global das 4 sub-abas do Resumo — só Período (+ Atualizar/
 * Exportar). Os filtros de Tipo e Responsável que existiam aqui (e os
 * equivalentes locais em cada aba — Tipo Trabalho/Responsável em Operação,
 * Temperatura/Origem/Responsável em Comercial, Categoria em Financeira)
 * foram removidos por pedido explícito: o Resumo é visão executiva rápida,
 * não precisa do mesmo nível de recorte dos módulos de origem — quem quiser
 * filtrar por responsável/tipo/categoria em detalhe usa o módulo específico
 * (Comercial, Operacional, Financeiro), que continua com esses filtros. */
export default function FilterBar({ filtros, onChange, onExportPdf, onExportCsv, onRefresh, atualizando }: Props) {
  const [mostrarExport, setMostrarExport] = useState(false);

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

      {filtros.periodo === "custom" && (
        <>
          <div>
            <label className="label-field">De</label>
            <input
              type="date"
              className="input-field"
              value={filtros.dataInicioCustom ?? ""}
              onChange={(e) => onChange({ ...filtros, dataInicioCustom: e.target.value })}
            />
          </div>
          <div>
            <label className="label-field">Até</label>
            <input
              type="date"
              className="input-field"
              value={filtros.dataFimCustom ?? ""}
              onChange={(e) => onChange({ ...filtros, dataFimCustom: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="ml-auto flex items-end gap-2">
        <div className="relative">
          <button type="button" className="btn-secondary" onClick={() => setMostrarExport((v) => !v)}>
            📥 Exportar ▾
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
              {onExportCsv && (
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
              )}
            </div>
          )}
        </div>
        <button type="button" className="btn-primary" onClick={onRefresh} disabled={atualizando}>
          {atualizando ? "Atualizando..." : "🔄 Atualizar"}
        </button>
      </div>
    </div>
  );
}
