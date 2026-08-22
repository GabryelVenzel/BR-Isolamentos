"use client";

import { useEffect, useState } from "react";
import { toast } from "./toast";
import type { ConfigReativacaoLeadsFrios } from "@/lib/types/domain";

type FormPrazos = Record<"dias_prospeccao" | "dias_contato" | "dias_proposta" | "dias_negociacao", string>;

const CAMPOS: Array<{ chave: keyof FormPrazos; label: string }> = [
  { chave: "dias_prospeccao", label: "Se frio em Prospecção → Retornar em" },
  { chave: "dias_contato", label: "Se frio em Contato → Retornar em" },
  { chave: "dias_proposta", label: "Se frio em Proposta → Retornar em" },
  { chave: "dias_negociacao", label: "Se frio em Negociação → Retornar em" },
];

/** Só os prazos de reativação de leads frios — as outras configurações do
 * mockup (automação de e-mail, tags customizadas, exportação) estão
 * marcadas como "(Futuro)" no próprio pedido, fora do escopo desta versão. */
export default function ConfiguracoesTab() {
  const [form, setForm] = useState<FormPrazos>({
    dias_prospeccao: "15",
    dias_contato: "20",
    dias_proposta: "30",
    dias_negociacao: "40",
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/comercial/configuracoes/reativacao")
      .then((r) => r.json())
      .then((payload) => {
        if (payload.success) {
          const config: ConfigReativacaoLeadsFrios = payload.data;
          setForm({
            dias_prospeccao: String(config.dias_prospeccao),
            dias_contato: String(config.dias_contato),
            dias_proposta: String(config.dias_proposta),
            dias_negociacao: String(config.dias_negociacao),
          });
        }
      })
      .finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const response = await fetch("/api/comercial/configuracoes/reativacao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dias_prospeccao: Number(form.dias_prospeccao),
          dias_contato: Number(form.dias_contato),
          dias_proposta: Number(form.dias_proposta),
          dias_negociacao: Number(form.dias_negociacao),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível salvar as configurações.");
        return;
      }
      toast.sucesso("Prazos de reativação atualizados.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="card max-w-lg space-y-4">
      <div>
        <h2 className="font-montserrat text-sm font-bold uppercase text-brand">Prazos de Reativação de Leads Frios</h2>
        <p className="text-xs text-gray-500">
          Quando um lead vira &quot;Frio&quot;, o sistema agenda um retorno automático depois de N dias — o prazo depende da
          etapa em que o lead esfriou. Só afeta agendamentos criados a partir de agora; os já agendados mantêm a data
          original.
        </p>
      </div>

      <div className="space-y-3">
        {CAMPOS.map(({ chave, label }) => (
          <div key={chave} className="flex items-center justify-between gap-3">
            <label className="label-field flex-1">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="input-field w-20"
                value={form[chave]}
                onChange={(e) => setForm((prev) => ({ ...prev, [chave]: e.target.value }))}
              />
              <span className="text-sm text-gray-500">dias</span>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
