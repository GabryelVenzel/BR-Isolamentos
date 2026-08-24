"use client";

import { useEffect, useState } from "react";
import ToastContainer from "@/components/modules/financeiro/ToastContainer";
import { toast } from "@/components/modules/financeiro/toast";

/** Só o ciclo financeiro é configurável aqui — os outros itens do mockup
 * original ("moeda padrão", "backup automático", "exportar dados") não
 * viraram tela de configuração: moeda já é BRL fixo em todo o app (não há
 * outro valor suportado em lugar nenhum do código pra essa config
 * "escolher"), backup automático é responsabilidade de infraestrutura do
 * Supabase (não uma opção que o app liga/desliga), e "exportar dados" não
 * foi detalhado o suficiente no pedido (qual formato, quais dados exatos)
 * pra implementar com confiança — melhor deixar de fora do que construir
 * algo que não corresponde ao que realmente se precisa. */
export default function ConfiguracoesFinanceiroPage() {
  const [diaInicioCiclo, setDiaInicioCiclo] = useState("1");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/financeiro/configuracoes")
      .then((r) => r.json())
      .then((p) => p.success && setDiaInicioCiclo(String(p.data.dia_inicio_ciclo)))
      .finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const response = await fetch("/api/financeiro/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dia_inicio_ciclo: Number(diaInicioCiclo) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível salvar a configuração.");
        return;
      }
      toast.sucesso("Configuração atualizada.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <ToastContainer />

      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-gray-500">Ciclo financeiro e moeda padrão.</p>
      </div>

      {carregando ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="card max-w-md space-y-4">
          <div>
            <h2 className="font-montserrat text-sm font-bold uppercase text-brand">Ciclo Financeiro</h2>
            <p className="mt-1 text-xs text-gray-500">
              Dia do mês em que o "mês financeiro" começa. Hoje os relatórios e o dashboard usam o calendário civil
              (dia 1 a 31) — essa configuração fica guardada, mas ainda não é aplicada aos cálculos existentes.
            </p>
          </div>
          <div>
            <label className="label-field">Dia de início do ciclo</label>
            <input
              type="number"
              min={1}
              max={28}
              className="input-field max-w-[8rem]"
              value={diaInicioCiclo}
              onChange={(e) => setDiaInicioCiclo(e.target.value)}
            />
          </div>
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>

          <div className="border-t border-gray-100 pt-4">
            <h2 className="font-montserrat text-sm font-bold uppercase text-brand">Moeda</h2>
            <p className="mt-1 text-sm text-gray-500">Real brasileiro (R$) — fixo, não há outra moeda suportada.</p>
          </div>
        </div>
      )}
    </div>
  );
}
