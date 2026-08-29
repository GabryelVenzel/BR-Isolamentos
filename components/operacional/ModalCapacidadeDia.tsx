"use client";

import { useCallback, useEffect, useState } from "react";
import { TIPOS_TRABALHO_OPCOES } from "@/components/modules/operacional/MultiSelectTiposTrabalho";
import { formatarData } from "@/lib/format";
import type { CapacidadeDia } from "@/lib/usecases/operacional";

// Lista revisada (migração 027) — reaproveita a mesma fonte de sempre, ver
// MultiSelectTiposTrabalho.tsx.
const LABEL_TIPO: Record<string, string> = Object.fromEntries(TIPOS_TRABALHO_OPCOES.map((o) => [o.valor, o.label]));

interface Props {
  data: string;
  onFechar: () => void;
}

/** Modal "Detalhes de Capacidade" — abre ao clicar num dia do calendário da
 * Agenda. Mesmo conteúdo que a antiga aba "Capacidade" (agora removida como
 * aba própria, incorporada aqui — ver decisão em app/operacional/page.tsx),
 * só que como modal em vez de página cheia. */
export default function ModalCapacidadeDia({ data, onFechar }: Props) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <button type="button" className="mb-1 text-xs text-brand hover:underline" onClick={onFechar}>
              ← Voltar
            </button>
            <h2 className="font-montserrat text-lg font-bold text-brand">Detalhes de Capacidade — {formatarData(data)}</h2>
          </div>
          <button type="button" className="text-gray-400 hover:text-gray-600" onClick={onFechar} aria-label="Fechar">
            ✕
          </button>
        </div>

        {carregando ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : erro || !capacidade ? (
          <div className="text-sm text-status-error">
            <p>{erro ?? "Não foi possível calcular a capacidade."}</p>
            <button type="button" className="btn-secondary mt-3" onClick={carregar}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <h3 className="font-montserrat text-sm font-bold uppercase text-brand">Por Parceiro</h3>
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
                        {parceiroExpandido === p.parceiroId ? "Ocultar serviços" : `Ver serviços de hoje (${p.servicos.length})`}
                      </button>
                    )}

                    {parceiroExpandido === p.parceiroId && (
                      <div className="space-y-2 border-t border-gray-100 pt-2">
                        {p.servicos.map((s) => (
                          <div key={s.servicoId} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium text-brand">{s.numeroServico}</span>
                              {s.tipoTrabalho && <span className="text-gray-500"> · {LABEL_TIPO[s.tipoTrabalho] ?? s.tipoTrabalho}</span>}
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
          </div>
        )}
      </div>
    </div>
  );
}
