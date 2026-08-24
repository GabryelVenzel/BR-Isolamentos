"use client";

import { useState } from "react";
import { toast } from "./toast";
import { formatarData, formatarMoeda } from "@/lib/format";
import { calcularProximoPagamento } from "@/lib/usecases/financeiro/custoFixo";
import type { CustoFixo, HistoricoCustoFixo } from "@/lib/types/domain";

interface Props {
  custoFixo: CustoFixo;
  onEditar: () => void;
  onMudou: () => void;
}

const LABEL_STATUS: Record<string, string> = { pendente: "Pendente", pago: "Pago", atrasado: "Atrasado" };
const CLASSES_STATUS: Record<string, string> = {
  pendente: "bg-secondary-light text-brand",
  pago: "bg-accent-light text-accent-dark",
  atrasado: "bg-red-100 text-status-error",
};

export default function CustoFixoCard({ custoFixo, onEditar, onMudou }: Props) {
  const [expandido, setExpandido] = useState(false);
  const [historico, setHistorico] = useState<HistoricoCustoFixo[] | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [pagando, setPagando] = useState(false);

  async function alternarExpandir() {
    const novoEstado = !expandido;
    setExpandido(novoEstado);
    if (novoEstado && historico === null) {
      setCarregandoHistorico(true);
      try {
        const response = await fetch(`/api/financeiro/custos-fixos/${custoFixo.id}/historico`);
        const payload = await response.json();
        if (payload.success) setHistorico(payload.data);
      } finally {
        setCarregandoHistorico(false);
      }
    }
  }

  async function alternarAtivo() {
    const response = await fetch(`/api/financeiro/custos-fixos/${custoFixo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !custoFixo.ativo }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível atualizar o custo fixo.");
      return;
    }
    onMudou();
  }

  async function marcarPago() {
    setPagando(true);
    try {
      const response = await fetch(`/api/financeiro/custos-fixos/${custoFixo.id}/pagar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.erro(data.error ?? "Não foi possível marcar como pago.");
        return;
      }
      toast.sucesso("Custo fixo pago — lançamento criado em Lançamentos.");
      setHistorico(null);
      if (expandido) alternarExpandir();
      onMudou();
    } finally {
      setPagando(false);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir o custo fixo "${custoFixo.descricao}"?`)) return;
    const response = await fetch(`/api/financeiro/custos-fixos/${custoFixo.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.success) {
      toast.erro(data.error ?? "Não foi possível excluir o custo fixo.");
      return;
    }
    toast.sucesso("Custo fixo excluído.");
    onMudou();
  }

  const proximoPagamento = custoFixo.dia_mes != null ? calcularProximoPagamento(custoFixo.dia_mes) : null;

  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-montserrat font-semibold text-brand">{custoFixo.descricao}</p>
        <button
          type="button"
          className={`badge shrink-0 ${custoFixo.ativo ? "bg-accent-light text-accent-dark" : "bg-gray-100 text-gray-500"}`}
          onClick={alternarAtivo}
        >
          {custoFixo.ativo ? "✅ Ativo" : "❌ Inativo"}
        </button>
      </div>

      <p className="font-montserrat text-lg font-bold text-brand">{formatarMoeda(custoFixo.valor_mensal)}/mês</p>
      {custoFixo.dia_mes != null && <p className="text-xs text-gray-500">Dia {custoFixo.dia_mes} de cada mês</p>}
      {proximoPagamento && <p className="text-xs text-gray-500">Próximo: {formatarData(proximoPagamento)}</p>}
      {custoFixo.notas && <p className="text-xs text-gray-400">{custoFixo.notas}</p>}

      <button type="button" className="text-xs text-brand hover:underline" onClick={alternarExpandir}>
        {expandido ? "Ocultar histórico ▲" : "Histórico ▼"}
      </button>

      {expandido && (
        <div className="space-y-1 border-t border-gray-100 pt-2">
          {carregandoHistorico ? (
            <p className="text-xs text-gray-400">Carregando...</p>
          ) : historico && historico.length > 0 ? (
            historico.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span>{formatarData(h.data_prevista)}</span>
                <span>{formatarMoeda(h.valor)}</span>
                <span className={`badge ${CLASSES_STATUS[h.status]}`}>{LABEL_STATUS[h.status]}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400">Sem histórico ainda.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-2">
        <button type="button" className="btn-accent text-xs" onClick={marcarPago} disabled={pagando || !custoFixo.ativo}>
          {pagando ? "Registrando..." : "Marcar como pago"}
        </button>
        <button type="button" className="btn-secondary text-xs" onClick={onEditar}>
          Editar
        </button>
        <button type="button" className="btn-danger text-xs" onClick={excluir}>
          Excluir
        </button>
      </div>
    </div>
  );
}
