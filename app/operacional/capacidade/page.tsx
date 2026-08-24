"use client";

import { useCallback, useEffect, useState } from "react";
import { formatarData } from "@/lib/format";
import type { CapacidadeDia } from "@/lib/usecases/operacional";

const LABEL_TIPO: Record<string, string> = {
  bancada: "Bancada",
  caldeiraria: "Caldeiraria",
  isolamentos_removiveis: "Isolamentos Removíveis",
  isolamentos_fixos: "Isolamentos Fixos",
};

function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Calendário de capacidade simplificado: escolher um dia (input de data,
 * padrão hoje) e ver o breakdown de mobilizados/disponíveis por parceiro —
 * em vez de um grid de mês customizado com mini-indicadores por dia, que
 * seria uma peça de UI bem maior pra um ganho de navegação pequeno (o
 * usuário sempre sabe qual dia quer olhar, não precisa "passear" pelo mês
 * pra descobrir). Ver decisão documentada no pedido original. */
export default function CapacidadePage() {
  const [data, setData] = useState(hojeISO());
  const [capacidade, setCapacidade] = useState<CapacidadeDia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [parceiroExpandido, setParceiroExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await fetch(`/api/operacional/capacidade?data=${data}`);
      const payload = await response.json();
      if (payload.success) {
        setCapacidade(payload.data);
      } else {
        setErro(payload.error ?? "Erro ao calcular a capacidade.");
      }
    } catch {
      setErro("Erro de conexão ao calcular a capacidade.");
    } finally {
      setCarregando(false);
    }
  }, [data]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Capacidade</h1>
        <p className="text-sm text-gray-500">Disponibilidade de mão de obra por dia, por parceiro.</p>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label-field">Dia</label>
          <input type="date" className="input-field" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary" onClick={() => setData(hojeISO())}>
          Hoje
        </button>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : erro || !capacidade ? (
        <div className="card text-sm text-status-error">
          <p>{erro ?? "Não foi possível calcular a capacidade."}</p>
          <button type="button" className="btn-secondary mt-3" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Total disponível</p>
              <p className="font-montserrat text-2xl font-bold text-brand">{capacidade.totalDisponivel}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Total mobilizado</p>
              <p className="font-montserrat text-2xl font-bold text-status-error">{capacidade.totalMobilizado}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs uppercase text-gray-500">Total livre</p>
              <p className="font-montserrat text-2xl font-bold text-accent">{capacidade.totalLivre}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-montserrat text-sm font-bold uppercase text-brand">Por Parceiro — {formatarData(data)}</h2>
            {capacidade.porParceiro.length === 0 ? (
              <div className="card text-center text-sm text-gray-500">Nenhum parceiro ativo cadastrado.</div>
            ) : (
              capacidade.porParceiro.map((p) => (
                <div key={p.parceiroId} className="card space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-montserrat font-semibold text-brand">{p.nome}</p>
                      <p className="text-xs text-gray-500">{p.tiposTrabalho.map((t) => LABEL_TIPO[t] ?? t).join(", ") || "—"}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>
                        <span className="font-bold text-status-error">{p.pessoasMobilizadas}</span> mobilizadas /{" "}
                        <span className="font-bold text-brand">{p.totalPessoas}</span> total
                      </p>
                      <p className="text-xs text-accent">{p.pessoasDisponiveis} disponíveis</p>
                    </div>
                  </div>

                  {p.servicos.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-brand hover:underline"
                      onClick={() => setParceiroExpandido((atual) => (atual === p.parceiroId ? null : p.parceiroId))}
                    >
                      {parceiroExpandido === p.parceiroId ? "Ocultar histórico" : "Ver histórico"}
                    </button>
                  )}

                  {parceiroExpandido === p.parceiroId && (
                    <div className="space-y-2 border-t border-gray-100 pt-2">
                      {p.servicos.map((s) => (
                        <div key={s.servicoId} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-brand">{s.numeroServico}</span>
                            {s.tipoTrabalho && <span className="text-gray-500"> · {LABEL_TIPO[s.tipoTrabalho] ?? s.tipoTrabalho}</span>}
                            {s.dataInicio && (
                              <span className="text-xs text-gray-400">
                                {" "}
                                · {formatarData(s.dataInicio)}
                                {s.dataFimPrevista && ` – ${formatarData(s.dataFimPrevista)}`}
                              </span>
                            )}
                          </div>
                          <span className="text-gray-500">{s.pessoas} pessoas</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
