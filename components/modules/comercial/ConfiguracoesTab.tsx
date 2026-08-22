"use client";

import { useEffect, useState } from "react";
import { toast } from "./toast";
import ResponsaveisSection from "./ResponsaveisSection";

type FormPrazos = Record<"dias_prospeccao" | "dias_contato" | "dias_proposta" | "dias_negociacao", string>;

interface ConfigPrazos {
  dias_prospeccao: number;
  dias_contato: number;
  dias_proposta: number;
  dias_negociacao: number;
}

interface CardPrazosProps {
  titulo: string;
  descricao: string;
  endpoint: string;
  labels: Record<keyof FormPrazos, string>;
  mensagemSucesso: string;
  padrao: FormPrazos;
}

/** Cartão genérico de "N dias por etapa" — reaproveitado pelos dois
 * formulários desta aba (prazo de reativação de leads frios e prazo máximo
 * de permanência por etapa). São duas configurações com o mesmo formato
 * (4 campos, um por etapa ativa) mas semânticas diferentes — ver
 * ConfigReativacaoLeadsFrios x ConfigPrazoEtapas em lib/types/domain.ts —
 * por isso dois endpoints/estados separados, só a UI é compartilhada. */
function CardPrazos({ titulo, descricao, endpoint, labels, mensagemSucesso, padrao }: CardPrazosProps) {
  const [form, setForm] = useState<FormPrazos>(padrao);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch(endpoint)
      .then((r) => r.json())
      .then((payload) => {
        if (payload.success) {
          const config: ConfigPrazos = payload.data;
          setForm({
            dias_prospeccao: String(config.dias_prospeccao),
            dias_contato: String(config.dias_contato),
            dias_proposta: String(config.dias_proposta),
            dias_negociacao: String(config.dias_negociacao),
          });
        }
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const response = await fetch(endpoint, {
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
      toast.sucesso(mensagemSucesso);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="card max-w-lg space-y-4">
      <div>
        <h2 className="font-montserrat text-sm font-bold uppercase text-brand">{titulo}</h2>
        <p className="text-xs text-gray-500">{descricao}</p>
      </div>

      <div className="space-y-3">
        {(Object.keys(labels) as Array<keyof FormPrazos>).map((chave) => (
          <div key={chave} className="flex items-center justify-between gap-3">
            <label className="label-field flex-1">{labels[chave]}</label>
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

const LABELS_REATIVACAO: Record<keyof FormPrazos, string> = {
  dias_prospeccao: "Se frio em Prospecção → Retornar em",
  dias_contato: "Se frio em Contato → Retornar em",
  dias_proposta: "Se frio em Proposta → Retornar em",
  dias_negociacao: "Se frio em Negociação → Retornar em",
};

const LABELS_PRAZO_ETAPA: Record<keyof FormPrazos, string> = {
  dias_prospeccao: "Máximo em Prospecção",
  dias_contato: "Máximo em Contato",
  dias_proposta: "Máximo em Proposta",
  dias_negociacao: "Máximo em Negociação",
};

/** As outras configurações do mockup original (automação de e-mail, tags
 * customizadas, exportação) estavam marcadas "(Futuro)" no próprio pedido —
 * fora do escopo desta versão, não implementadas. */
export default function ConfiguracoesTab() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6">
        <CardPrazos
          titulo="Prazos de Reativação de Leads Frios"
          descricao='Quando um lead vira "Frio", o sistema agenda um retorno automático depois de N dias — o prazo
            depende da etapa em que o lead esfriou. Só afeta agendamentos criados a partir de agora; os já agendados
            mantêm a data original.'
          endpoint="/api/comercial/configuracoes/reativacao"
          labels={LABELS_REATIVACAO}
          mensagemSucesso="Prazos de reativação atualizados."
          padrao={{ dias_prospeccao: "15", dias_contato: "20", dias_proposta: "30", dias_negociacao: "40" }}
        />

        <CardPrazos
          titulo="Prazo Máximo por Etapa (Leads Atrasados)"
          descricao='Quantos dias um lead pode ficar em cada etapa antes de aparecer marcado como "atrasado" no
            Kanban — ajuda a não deixar um lead parado por muito tempo sem avançar. Etapas terminais (Fechado/
            Perdido) não têm prazo.'
          endpoint="/api/comercial/configuracoes/prazo-etapas"
          labels={LABELS_PRAZO_ETAPA}
          mensagemSucesso="Prazos máximos por etapa atualizados."
          padrao={{ dias_prospeccao: "7", dias_contato: "10", dias_proposta: "15", dias_negociacao: "20" }}
        />
      </div>

      <ResponsaveisSection />
    </div>
  );
}
