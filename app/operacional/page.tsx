"use client";

import { useCallback, useEffect, useState } from "react";
import CalendarioCapacidade from "@/components/operacional/CalendarioCapacidade";
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
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

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
    setAnoMes((atual) => {
      const data = new Date(atual.ano, atual.mes - 1 + delta, 1);
      return { ano: data.getFullYear(), mes: data.getMonth() + 1 };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-secondary px-3" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
            ◀
          </button>
          <h1 className="w-40 text-center text-xl font-bold">
            {MESES[mes - 1]} {ano}
          </h1>
          <button type="button" className="btn-secondary px-3" onClick={() => mudarMes(1)} aria-label="Próximo mês">
            ▶
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={carregar} disabled={carregando}>
            {carregando ? "Atualizando..." : "🔄 Atualizar"}
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

      {carregando && dias.length === 0 ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        !erro && <CalendarioCapacidade ano={ano} mes={mes} dias={dias} onClickDia={setDiaSelecionado} />
      )}

      {diaSelecionado && <ModalCapacidadeDia data={diaSelecionado} onFechar={() => setDiaSelecionado(null)} />}
    </div>
  );
}
