"use client";

import { useCallback, useEffect, useState } from "react";
import { confirmar } from "@/components/ui/confirmar";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { formatarDataHora, formatarMoeda } from "@/lib/format";
import type { Servico } from "@/lib/types/domain";
import { toast } from "./toast";

interface Props {
  onFechar: () => void;
  /** Algo foi restaurado — a tela de serviços precisa recarregar. */
  onRestaurado: () => void;
}

const DIAS_NA_LIXEIRA = 30;

function diasRestantes(excluidoEm: string): number {
  const passados = (Date.now() - new Date(excluidoEm).getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(DIAS_NA_LIXEIRA - passados));
}

/** Lixeira de serviços (migração 045) — só administradores. Um serviço
 * excluído fica aqui por 30 dias: pode ser restaurado como estava ou
 * removido de vez. Passado o prazo, a rotina diária remove sozinha. */
export default function LixeiraServicos({ onFechar, onRestaurado }: Props) {
  const [servicos, setServicos] = useState<Servico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const response = await fetch("/api/operacional/servicos/lixeira");
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível carregar a lixeira.");
        return;
      }
      setServicos(payload.data);
    } catch {
      setErro("Erro de conexão ao carregar a lixeira.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(servico: Servico, acao: "restaurar" | "excluir") {
    if (acao === "excluir") {
      const seguir = await confirmar(
        `Excluir ${servico.numero_servico} definitivamente? Parceiros, diárias, linha do tempo e interações da obra são apagados. Os lançamentos financeiros continuam existindo, mas perdem o vínculo com a obra. Esta ação não pode ser desfeita pela tela.`,
        { titulo: "Excluir definitivamente", confirmarLabel: "Excluir de vez" }
      );
      if (!seguir) return;
    }

    setOcupado(servico.id);
    try {
      const response = await fetch("/api/operacional/servicos/lixeira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: servico.id, acao }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível concluir a ação.");
        return;
      }
      toast.sucesso(acao === "restaurar" ? `${servico.numero_servico} restaurado.` : `${servico.numero_servico} excluído definitivamente.`);
      if (acao === "restaurar") onRestaurado();
      carregar();
    } catch {
      toast.erro("Erro de conexão. Tente novamente.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-lixeira" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-6 shadow-card-hover">
        <h2 id="titulo-lixeira" className="mb-1 font-montserrat text-lg font-bold text-brand">
          Lixeira de serviços
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Serviços excluídos ficam aqui por {DIAS_NA_LIXEIRA} dias, com tudo preservado. Depois disso são removidos de vez automaticamente.
        </p>

        {erro ? (
          <div className="text-sm text-status-error">
            <p>{erro}</p>
            <button type="button" className="btn-secondary mt-3" onClick={carregar}>
              Tentar de novo
            </button>
          </div>
        ) : !servicos ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : servicos.length === 0 ? (
          <p className="text-sm text-gray-400">A lixeira está vazia.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {servicos.map((s) => {
              const restam = s.excluido_em ? diasRestantes(s.excluido_em) : DIAS_NA_LIXEIRA;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-montserrat text-sm font-bold text-brand">
                      {s.numero_servico}
                      {s.cliente?.nome && <span className="font-normal text-gray-700"> · {s.cliente.nome}</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.valor_orcado != null && `${formatarMoeda(s.valor_orcado)} · `}
                      Excluído{s.excluido_em ? ` em ${formatarDataHora(s.excluido_em)}` : ""}
                      {s.excluido_por ? ` por ${s.excluido_por}` : ""}
                    </p>
                    <p className={`text-xs ${restam <= 5 ? "font-semibold text-status-error" : "text-gray-500"}`}>
                      {restam === 0 ? "Será removido de vez na próxima rotina diária." : `Removido de vez em ${restam} dia${restam === 1 ? "" : "s"}.`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" className="btn-accent px-3 py-1.5 text-xs" disabled={ocupado !== null} onClick={() => agir(s, "restaurar")}>
                      Restaurar
                    </button>
                    <button type="button" className="btn-danger px-3 py-1.5 text-xs" disabled={ocupado !== null} onClick={() => agir(s, "excluir")}>
                      Excluir de vez
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
