"use client";

import type { CapacidadeResumoDia, NivelOcupacao } from "@/lib/usecases/operacional";

interface Props {
  ano: number;
  mes: number;
  dias: CapacidadeResumoDia[];
  onClickDia: (data: string) => void;
}

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAXIMO_SERVICOS_VISIVEIS = 2;

const CLASSES_NIVEL: Record<NivelOcupacao, string> = {
  livre: "bg-accent-light/60 border-accent-light hover:bg-accent-light",
  atencao: "bg-secondary-light/70 border-secondary-light hover:bg-secondary-light",
  critico: "bg-red-100 border-red-200 hover:bg-red-200",
};

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Grid de mês (tipo Google Calendar) da Agenda — um quadrado por dia,
 * colorido pelo nível de ocupação (`nivelOcupacao`), com as pessoas livres
 * e os serviços em andamento no dia já visíveis sem precisar abrir nada. Click no dia
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
    <div className="card p-3 sm:p-6">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center sm:gap-2 text-xs font-semibold uppercase text-gray-500">
        {DIAS_SEMANA.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
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
              aria-label={`Dia ${numeroDia}: ${dia.servicos.length} serviço(s), ${dia.totalLivre} de ${dia.totalDisponivel} pessoas livres`}
              className={`flex min-h-[56px] min-w-0 flex-col items-start rounded-lg border p-1.5 text-left text-xs transition-colors sm:min-h-[104px] sm:p-2 ${CLASSES_NIVEL[dia.nivel]} ${
                ehHoje ? "ring-2 ring-brand" : ""
              }`}
            >
              <span className="font-montserrat font-bold text-gray-700">{numeroDia}</span>
              {dia.totalDisponivel > 0 ? (
                <span className="mt-1 hidden text-[11px] leading-tight text-gray-600 sm:block">
                  Livres: {dia.totalLivre}/{dia.totalDisponivel}
                </span>
              ) : (
                <span className="mt-1 hidden text-[11px] text-gray-400 sm:block">—</span>
              )}
              {/* Serviços do dia: até 2 por extenso no computador; no celular
                  (quadrado pequeno) só a quantidade — o detalhe abre no toque. */}
              {dia.servicos.slice(0, MAXIMO_SERVICOS_VISIVEIS).map((s) => (
                <span
                  key={s.id}
                  className="mt-1 hidden w-full truncate rounded bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-brand sm:block"
                  title={`${s.numero}${s.cliente ? ` — ${s.cliente}` : ""}`}
                >
                  {s.numero}
                  {s.cliente && <span className="font-normal text-gray-600"> · {s.cliente}</span>}
                </span>
              ))}
              {dia.servicos.length > MAXIMO_SERVICOS_VISIVEIS && (
                <span className="mt-0.5 hidden text-[11px] text-gray-500 sm:block">
                  +{dia.servicos.length - MAXIMO_SERVICOS_VISIVEIS} serviço{dia.servicos.length - MAXIMO_SERVICOS_VISIVEIS === 1 ? "" : "s"}
                </span>
              )}
              {dia.servicos.length > 0 && (
                <span className="mt-1 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white sm:hidden">{dia.servicos.length}</span>
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
