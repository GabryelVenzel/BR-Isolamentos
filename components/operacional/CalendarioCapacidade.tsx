"use client";

import Link from "next/link";
import type { CapacidadeResumoDia, NivelOcupacao } from "@/lib/usecases/operacional";

interface Props {
  ano: number;
  mes: number;
  dias: CapacidadeResumoDia[];
  /** Dia selecionado (a lista dele aparece abaixo do calendário). */
  selecionado: string | null;
  onSelecionarDia: (data: string) => void;
}

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
/** Faixas de obra por semana antes de virar "+N". */
const MAXIMO_FAIXAS = 3;

const CLASSES_NIVEL: Record<NivelOcupacao, string> = {
  livre: "bg-accent-light/50 hover:bg-accent-light",
  atencao: "bg-secondary-light/70 hover:bg-secondary-light",
  critico: "bg-red-100 hover:bg-red-200",
};

/** Cores das barras — cada obra fica sempre com a mesma (pelo id). */
const CORES_OBRA = ["bg-brand", "bg-accent-dark", "bg-sky-700", "bg-purple-700", "bg-orange-600", "bg-teal-700", "bg-pink-700", "bg-slate-600"];
export function corDaObra(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_OBRA[h % CORES_OBRA.length];
}

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

interface Barra {
  id: string;
  numero: string;
  cliente: string | null;
  inicio: number; // coluna 0..6
  fim: number; // coluna 0..6 (inclusiva)
  faixa: number;
}

/** Barras de obra de uma semana: cada obra vira um trecho contínuo do
 * primeiro ao último dia em que aparece na semana, empilhado na primeira
 * faixa livre (como no Google Agenda). */
function barrasDaSemana(semana: Array<CapacidadeResumoDia | null>): Barra[] {
  const porObra = new Map<string, Omit<Barra, "faixa">>();
  semana.forEach((dia, col) => {
    dia?.servicos.forEach((s) => {
      const b = porObra.get(s.id);
      if (b) b.fim = col;
      else porObra.set(s.id, { id: s.id, numero: s.numero, cliente: s.cliente, inicio: col, fim: col });
    });
  });
  const ordenadas = [...porObra.values()].sort((a, b) => a.inicio - b.inicio || b.fim - b.inicio - (a.fim - a.inicio));
  const ocupadoAte: number[] = [];
  return ordenadas.map((b) => {
    let faixa = ocupadoAte.findIndex((fim) => fim < b.inicio);
    if (faixa < 0) faixa = ocupadoAte.length;
    ocupadoAte[faixa] = b.fim;
    return { ...b, faixa };
  });
}

/** Calendário do mês da Agenda (revisão de usabilidade): cada dia colorido
 * pela ocupação da equipe (livre/atenção/crítico) com as pessoas livres, e
 * as obras como BARRAS contínuas atravessando os dias em que estão em
 * andamento — dá para ver de relance onde cada obra começa e termina.
 * Clicar/tocar num dia mostra a lista dele abaixo do calendário; clicar numa
 * barra abre a obra. Sem biblioteca de calendário: um grid de semanas basta. */
export default function CalendarioCapacidade({ ano, mes, dias, selecionado, onSelecionarDia }: Props) {
  const primeiroDiaSemana = (new Date(ano, mes - 1, 1).getDay() + 6) % 7; // 0 = segunda
  const celulas: Array<CapacidadeResumoDia | null> = [...Array.from({ length: primeiroDiaSemana }, () => null), ...dias];
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas = Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));
  const hoje = hojeISO();

  return (
    <div className="card p-2 sm:p-4">
      <div className="grid grid-cols-7 gap-px pb-1 text-center text-xs font-semibold uppercase text-gray-500">
        {DIAS_SEMANA.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {semanas.map((semana, i) => {
          const barras = barrasDaSemana(semana);
          const visiveis = barras.filter((b) => b.faixa < MAXIMO_FAIXAS);
          const faixas = Math.min(MAXIMO_FAIXAS, Math.max(0, ...barras.map((b) => b.faixa + 1)));
          return (
            <div key={i} className="relative">
              {/* Fundo: os dias (clicáveis) */}
              <div className="grid grid-cols-7 gap-1">
                {semana.map((dia, col) =>
                  dia ? (
                    <button
                      key={dia.data}
                      type="button"
                      onClick={() => onSelecionarDia(dia.data)}
                      aria-pressed={selecionado === dia.data}
                      aria-label={`Dia ${Number(dia.data.slice(-2))}: ${dia.servicos.length} obra(s), ${dia.totalLivre} de ${dia.totalDisponivel} pessoas livres`}
                      className={`flex min-h-[calc(2.5rem+var(--faixas)*0.625rem)] min-w-0 flex-col items-start rounded-lg p-1 sm:min-h-[calc(3.25rem+var(--faixas)*1.5rem)] text-left sm:p-1.5 ${CLASSES_NIVEL[dia.nivel]} ${
                        dia.data === hoje ? "ring-2 ring-brand" : ""
                      } ${selecionado === dia.data ? "outline outline-2 outline-offset-1 outline-secondary" : ""}`}
                      style={{ "--faixas": faixas } as React.CSSProperties}
                    >
                      <span className="flex w-full items-baseline justify-between gap-1">
                        <span className="font-montserrat text-sm font-bold text-gray-700">{Number(dia.data.slice(-2))}</span>
                        {dia.totalDisponivel > 0 && (
                          <span className="hidden text-xs text-gray-600 sm:inline" title="Pessoas livres / disponíveis">
                            {dia.totalLivre}/{dia.totalDisponivel}
                          </span>
                        )}
                      </span>
                    </button>
                  ) : (
                    <div key={`v${col}`} />
                  )
                )}
              </div>
              {/* Frente: as barras das obras, alinhadas às colunas */}
              <div className="pointer-events-none absolute inset-x-0 top-6 grid grid-cols-7 gap-x-1 gap-y-0.5 sm:top-8">
                {visiveis.map((b) => (
                  <Link
                    key={b.id}
                    href={`/operacional/servicos/${b.id}`}
                    title={`${b.numero}${b.cliente ? ` — ${b.cliente}` : ""}`}
                    className={`pointer-events-none block h-2 truncate rounded-full sm:pointer-events-auto text-white sm:h-auto sm:rounded sm:px-1.5 sm:py-0.5 sm:text-xs sm:font-semibold ${corDaObra(b.id)} hover:opacity-80`}
                    style={{ gridColumn: `${b.inicio + 1} / ${b.fim + 2}`, gridRow: b.faixa + 1 }}
                  >
                    <span className="hidden sm:inline">
                      {b.numero}
                      {b.cliente && <span className="font-normal opacity-90"> · {b.cliente}</span>}
                    </span>
                    <span className="sr-only sm:hidden">{b.numero}</span>
                  </Link>
                ))}
              </div>
              {barras.length > visiveis.length && (
                <p className="mt-0.5 text-right text-xs text-gray-500">+{barras.length - visiveis.length} obra(s) nesta semana — toque no dia para ver</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-accent-light" /> Equipe livre (≤ 70%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-secondary-light" /> Atenção (70–90%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-red-100" /> Crítico (&gt; 90%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full bg-brand" /> Obra em andamento
        </span>
      </div>
    </div>
  );
}
