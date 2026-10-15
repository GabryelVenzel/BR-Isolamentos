"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Carregando } from "@/components/ui/Esqueleto";
import CalendarioCapacidade, { corDaObra } from "@/components/operacional/CalendarioCapacidade";
import SemanaCapacidade from "@/components/operacional/SemanaCapacidade";
import ModalCapacidadeDia from "@/components/operacional/ModalCapacidadeDia";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { useEstadoLembrado } from "@/lib/hooks/useEstadoLembrado";
import { formatarData } from "@/lib/format";
import type { CapacidadeResumoDia } from "@/lib/usecases/operacional";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Visao = "semana" | "mes";

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Soma dias a uma data YYYY-MM-DD (em UTC, sem fuso). */
function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana da data. */
function inicioDaSemana(iso: string): string {
  const diaSemana = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = segunda
  return somarDias(iso, -diaSemana);
}

/** Aba "Agenda" — calendário de capacidade alimentado pelos SERVIÇOS
 * (data_inicio/data_fim_prevista): ocupação da equipe por dia e as obras em
 * andamento. Duas visões: MÊS (longo prazo — obras em barras pelo mês) e
 * SEMANA (curto prazo — cada dia com a equipe e todas as obras por extenso).
 * A visão escolhida fica lembrada. Tocar num dia mostra a lista dele; o
 * detalhe por parceiro/funcionário abre em "Equipe do dia". */
export default function AgendaPage() {
  const [visao, setVisao] = useEstadoLembrado<Visao>("agenda-visao", "mes");
  // Data de referência: o mês dela (visão mês) ou a semana dela (visão semana).
  const [referencia, setReferencia] = useState(hojeISO);
  const [dias, setDias] = useState<CapacidadeResumoDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [detalheDia, setDetalheDia] = useState<string | null>(null);

  const ano = Number(referencia.slice(0, 4));
  const mes = Number(referencia.slice(5, 7));
  const segunda = inicioDaSemana(referencia);
  const domingo = somarDias(segunda, 6);
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      // A semana pode atravessar dois meses: busca os meses que ela toca.
      const meses = visao === "mes" ? [referencia.slice(0, 7)] : [...new Set([segunda.slice(0, 7), domingo.slice(0, 7)])];
      const respostas = await Promise.all(
        meses.map((m) => fetch(`/api/operacional/capacidade/mes?ano=${Number(m.slice(0, 4))}&mes=${Number(m.slice(5, 7))}`).then((r) => r.json()))
      );
      const falha = respostas.find((p) => !p.success);
      if (falha) {
        setErro(falha.error ?? "Erro ao carregar a agenda.");
        return;
      }
      setDias(respostas.flatMap((p) => p.data as CapacidadeResumoDia[]));
    } catch {
      setErro("Erro de conexão ao carregar a agenda.");
    } finally {
      setCarregando(false);
    }
  }, [visao, referencia, segunda, domingo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function navegar(delta: number) {
    setDiaSelecionado(null);
    if (visao === "semana") {
      setReferencia((r) => somarDias(r, delta * 7));
    } else {
      const d = new Date(Date.UTC(ano, mes - 1 + delta, 1));
      setReferencia(d.toISOString().slice(0, 10));
    }
  }

  const titulo =
    visao === "mes"
      ? `${MESES[mes - 1]} ${ano}`
      : segunda.slice(0, 7) === domingo.slice(0, 7)
        ? `${Number(segunda.slice(8))} a ${Number(domingo.slice(8))} de ${MESES_CURTOS[Number(domingo.slice(5, 7)) - 1]}`
        : `${Number(segunda.slice(8))} ${MESES_CURTOS[Number(segunda.slice(5, 7)) - 1]} a ${Number(domingo.slice(8))} ${MESES_CURTOS[Number(domingo.slice(5, 7)) - 1]}`;

  const diasDoMes = dias.filter((d) => d.data.slice(0, 7) === referencia.slice(0, 7));
  const diasVisiveis = visao === "mes" ? diasDoMes : diasDaSemana.map((data) => dias.find((d) => d.data === data)).filter((d): d is CapacidadeResumoDia => Boolean(d));
  const dia = dias.find((d) => d.data === diaSelecionado) ?? null;

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Agenda"
        descricao="Obras em andamento e ocupação da equipe por dia — semana para o curto prazo, mês para o longo prazo."
        acaoPrincipal={{ label: "+ Novo Serviço", href: "/operacional/servicos?novo=1" }}
        acoes={[{ label: carregando ? "Atualizando..." : "Atualizar", onClick: carregar }]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" className="btn-secondary px-3" onClick={() => navegar(-1)} aria-label={visao === "mes" ? "Mês anterior" : "Semana anterior"}>
            ◀
          </button>
          <h2 className="w-40 text-center text-lg font-bold sm:w-48">{titulo}</h2>
          <button type="button" className="btn-secondary px-3" onClick={() => navegar(1)} aria-label={visao === "mes" ? "Próximo mês" : "Próxima semana"}>
            ▶
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-input border border-gray-200 bg-white p-0.5" role="group" aria-label="Visualização">
            {(["semana", "mes"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={visao === v}
                className={`rounded-input px-3 py-1.5 text-sm font-semibold ${visao === v ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-50"}`}
                onClick={() => {
                  setDiaSelecionado(null);
                  setVisao(v);
                }}
              >
                {v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setDiaSelecionado(null);
              setReferencia(hojeISO());
            }}
          >
            Hoje
          </button>
        </div>
      </div>

      {erro && (
        <div className="card text-sm text-status-error">
          <p>{erro}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {carregando && diasVisiveis.length === 0 ? (
        <Carregando linhas={6} />
      ) : (
        !erro &&
        (visao === "mes" ? (
          <CalendarioCapacidade ano={ano} mes={mes} dias={diasDoMes} selecionado={diaSelecionado} onSelecionarDia={setDiaSelecionado} />
        ) : (
          <SemanaCapacidade dias={diasVisiveis} hoje={hojeISO()} onEquipeDoDia={setDetalheDia} />
        ))
      )}

      {visao === "mes" && dia && (
        <section className="card space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{formatarData(dia.data)}</h2>
              <p className="text-sm text-gray-500">
                {dia.totalDisponivel > 0 ? `${dia.totalLivre} de ${dia.totalDisponivel} pessoas livres · ${dia.totalMobilizado} mobilizada(s)` : "Sem equipe cadastrada para este dia."}
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setDetalheDia(dia.data)}>
              Equipe do dia
            </button>
          </div>
          {dia.servicos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma obra em andamento neste dia.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {dia.servicos.map((s) => (
                <li key={s.id}>
                  <Link href={`/operacional/servicos/${s.id}`} className="flex items-center gap-3 rounded-input px-1 py-2.5 hover:bg-gray-50">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${corDaObra(s.id)}`} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-semibold text-brand">{s.numero}</span>
                      {s.cliente && <span className="block truncate text-sm text-gray-500">{s.cliente}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {detalheDia && <ModalCapacidadeDia data={detalheDia} onFechar={() => setDetalheDia(null)} />}
    </div>
  );
}
