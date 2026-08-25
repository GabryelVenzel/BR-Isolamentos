"use client";

import type { CapacidadeResumoDia, NivelOcupacao } from "@/lib/usecases/operacional";

interface Props {
  ano: number;
  mes: number;
  dias: CapacidadeResumoDia[];
  onClickDia: (data: string) => void;
}

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const CLASSES_NIVEL: Record<NivelOcupacao, string> = {
  livre: "bg-accent-light/60 border-accent-light hover:bg-accent-light",
  atencao: "bg-secondary-light/70 border-secondary-light hover:bg-secondary-light",
  critico: "bg-red-100 border-red-200 hover:bg-red-200",
};

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Grid de mês (tipo Google Calendar) da Agenda — um quadrado por dia,
 * colorido pelo nível de ocupação (`nivelOcupacao`), com o resumo
 * "Disp X/Y | Mobiliz Z" já visível sem precisar abrir nada. Click no dia
 * abre o modal de detalhe por parceiro (ModalCapacidadeDia). Construído sem
 * biblioteca de calendário nova (react-big-calendar etc.) — um grid de mês é
 * simples o bastante pra não justificar uma dependência a mais; não inclui
 * drag & drop de reagendamento (fora do escopo desta rodada — reagendar já é
 * possível editando data_inicio/data_fim_prevista no modal de detalhe do
 * serviço, em Operacional → Serviços). */
export default function CalendarioCapacidade({ ano, mes, dias, onClickDia }: Props) {
  const primeiroDiaSemana = (new Date(ano, mes - 1, 1).getDay() + 6) % 7; // 0 = segunda
  const celulasVazias = Array.from({ length: primeiroDiaSemana });
  const hoje = hojeISO();

  return (
    <div className="card">
      <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-gray-500">
        {DIAS_SEMANA.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {celulasVazias.map((_, i) => (
          <div key={`vazio-${i}`} />
        ))}
        {dias.map((dia) => {
          const numeroDia = Number(dia.data.slice(-2));
          const ehHoje = dia.data === hoje;
          return (
            <button
              key={dia.data}
              type="button"
              onClick={() => onClickDia(dia.data)}
              className={`flex min-h-[72px] flex-col items-start rounded-lg border p-2 text-left text-xs transition-colors ${CLASSES_NIVEL[dia.nivel]} ${
                ehHoje ? "ring-2 ring-brand" : ""
              }`}
            >
              <span className="font-montserrat font-bold text-gray-700">{numeroDia}</span>
              {dia.totalDisponivel > 0 ? (
                <span className="mt-1 text-[11px] leading-tight text-gray-600">
                  Disp: {dia.totalLivre}/{dia.totalDisponivel}
                  <br />
                  Mobiliz: {dia.totalMobilizado}
                </span>
              ) : (
                <span className="mt-1 text-[11px] text-gray-400">—</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-accent-light/60" /> Livre (≤ 70%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-secondary-light/70" /> Atenção (70–90%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-red-100" /> Crítico (&gt; 90%)
        </span>
      </div>
    </div>
  );
}
