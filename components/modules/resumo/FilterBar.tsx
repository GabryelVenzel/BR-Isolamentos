"use client";

import { useState } from "react";
import type { FiltrosResumo, Periodo } from "@/lib/types/resumo";
import { Download } from "lucide-react";

interface Props {
  filtros: FiltrosResumo;
  onChange: (filtros: FiltrosResumo) => void;
  onExportPdf: () => void;
  onExportCsv?: () => void;
  onRefresh: () => void;
  atualizando?: boolean;
}

// Pedido explícito: 3 linhas comparáveis (Semana/Mês/Ano), cada uma com
// Atual/Anterior lado a lado — troca rápida pra comparativo rápido (ex.:
// clicar "Anterior" na linha Mês pra ver o mês passado inteiro, sem precisar
// abrir um <select> e procurar a opção certa). Períodos fechados/alinhados
// ao calendário — ver lib/usecases/resumo/periodo.ts#resolverPeriodo pros
// intervalos exatos de cada um.
const LINHAS_PERIODO: Array<{ label: string; atual: Periodo; anterior: Periodo }> = [
  { label: "Semana", atual: "semana_atual", anterior: "semana_anterior" },
  { label: "Mês", atual: "mes_atual", anterior: "mes_anterior" },
  { label: "Ano", atual: "ano_atual", anterior: "ano_anterior" },
];

function botaoSegmento(ativo: boolean): string {
  return `px-3 py-1.5 text-sm font-medium transition-colors ${
    ativo ? "bg-brand text-white" : "bg-white text-gray-600 hover:bg-gray-50"
  }`;
}

/** Filtro global das 4 sub-abas do Resumo — Período (+ Atualizar/Exportar).
 * Os filtros de Tipo e Responsável que existiam aqui (e os equivalentes
 * locais em cada aba — Tipo Trabalho/Responsável em Operação, Temperatura/
 * Origem/Responsável em Comercial, Categoria em Financeira) foram removidos
 * por pedido explícito: o Resumo é visão executiva rápida, não precisa do
 * mesmo nível de recorte dos módulos de origem — quem quiser filtrar por
 * responsável/tipo/categoria em detalhe usa o módulo específico (Comercial,
 * Operacional, Financeiro), que continua com esses filtros.
 *
 * Pedido explícito (rodada "filtros por linhas"): as 4 abas do Resumo usam
 * este MESMO componente agora — Operação/Comercial/Financeira tinham cada
 * uma seu próprio `<select>` de período, mais simples e sem Personalizado;
 * ver DashboardOperacao/DashboardComercial/DashboardFinanceira.tsx. */
export default function FilterBar({ filtros, onChange, onExportPdf, onExportCsv, onRefresh, atualizando }: Props) {
  const [mostrarExport, setMostrarExport] = useState(false);

  return (
    <div className="card flex flex-wrap items-end gap-4">
      {LINHAS_PERIODO.map((linha) => (
        <div key={linha.label}>
          <label className="label-field">{linha.label}</label>
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            <button type="button" className={botaoSegmento(filtros.periodo === linha.atual)} onClick={() => onChange({ ...filtros, periodo: linha.atual })}>
              Atual
            </button>
            <button
              type="button"
              className={`border-l border-gray-200 ${botaoSegmento(filtros.periodo === linha.anterior)}`}
              onClick={() => onChange({ ...filtros, periodo: linha.anterior })}
            >
              Anterior
            </button>
          </div>
        </div>
      ))}

      <div>
        <label className="label-field">Personalizado</label>
        <button
          type="button"
          className={`rounded-lg border border-gray-200 ${botaoSegmento(filtros.periodo === "custom")}`}
          onClick={() => onChange({ ...filtros, periodo: "custom" })}
        >
          Escolher datas...
        </button>
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
            <Download className="icone" aria-hidden /> Exportar ▾
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
          {atualizando ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
    </div>
  );
}
