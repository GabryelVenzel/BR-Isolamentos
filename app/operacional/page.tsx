"use client";
import { Carregando } from "@/components/ui/Esqueleto";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CalendarioCapacidade, { corDaObra } from "@/components/operacional/CalendarioCapacidade";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { formatarData } from "@/lib/format";
import ModalCapacidadeDia from "@/components/operacional/ModalCapacidadeDia";
import type { CapacidadeResumoDia } from "@/lib/usecases/operacional";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function hojeSaoPaulo(): { ano: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "numeric" })
    .formatToParts(new Date());
  const ano = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  return { ano, mes };
}

/** Aba "Agenda" — antes uma lista de agendamentos avulsos (tabela
 * `agendamentos`, criados manualmente vinculados a um orçamento), agora um
 * CALENDÁRIO VISUAL de capacidade (tipo Google Calendar): um quadrado por
 * dia mostrando disponível/mobilizado, colorido por nível de ocupação,
 * clicável para o detalhe por parceiro. A aba "Capacidade" que existia
 * separada foi removida — este calendário é exatamente ela, só que com
 * navegação por mês em vez de escolher uma data avulsa (ver
 * components/operacional/CalendarioCapacidade.tsx e ModalCapacidadeDia.tsx).
 *
 * A criação manual de "agendamentos" (tabela/API antigas) não tem mais tela
 * própria aqui: o calendário passou a ser alimentado pelos SERVIÇOS
 * (data_inicio/data_fim_prevista, já editáveis no detalhe do serviço em
 * Operacional → Serviços), que é a fonte de verdade de "o que está agendado"
 * hoje no sistema — manter as duas telas (agendamentos avulsos E serviços
 * com data) fragmentaria a agenda em duas fontes conflitantes. */
export default function AgendaPage() {
  const [{ ano, mes }, setAnoMes] = useState(hojeSaoPaulo);
  const [dias, setDias] = useState<CapacidadeResumoDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Dia escolhido no calendário: a lista dele aparece embaixo; o detalhe
  // por parceiro/funcionário abre na janela (ModalCapacidadeDia).
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [detalheDia, setDetalheDia] = useState<string | null>(null);
  const dia = dias.find((d) => d.data === diaSelecionado) ?? null;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/operacional/capacidade/mes?ano=${ano}&mes=${mes}`);
      const payload = await response.json();
      if (payload.success) {
        setDias(payload.data);
      } else {
        setErro(payload.error ?? "Erro ao carregar a agenda.");
      }
    } catch {
      setErro("Erro de conexão ao carregar a agenda.");
    } finally {
      setCarregando(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function mudarMes(delta: number) {
    setDiaSelecionado(null);
    setAnoMes((atual) => {
      const data = new Date(atual.ano, atual.mes - 1 + delta, 1);
      return { ano: data.getFullYear(), mes: data.getMonth() + 1 };
    });
  }

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Agenda"
        descricao="Obras em andamento e ocupação da equipe por dia — toque num dia para ver a lista."
        acaoPrincipal={{ label: "+ Novo Serviço", href: "/operacional/servicos?novo=1" }}
        acoes={[{ label: carregando ? "Atualizando..." : "Atualizar", onClick: carregar }]}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" className="btn-secondary px-3" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
            ◀
          </button>
          <h2 className="w-36 text-center text-lg font-bold sm:w-44">
            {MESES[mes - 1]} {ano}
          </h2>
          <button type="button" className="btn-secondary px-3" onClick={() => mudarMes(1)} aria-label="Próximo mês">
            ▶
          </button>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setDiaSelecionado(null);
            setAnoMes(hojeSaoPaulo());
          }}
        >
          Hoje
        </button>
      </div>

      {erro && (
        <div className="card text-sm text-status-error">
          <p>{erro}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {carregando && dias.length === 0 ? (
        <Carregando />
      ) : (
        !erro && <CalendarioCapacidade ano={ano} mes={mes} dias={dias} selecionado={diaSelecionado} onSelecionarDia={setDiaSelecionado} />
      )}

      {dia && (
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
