"use client";

import { useState, type FormEvent } from "react";
import type { AnexoSimplesNacional, ConfigEmpresa, RegimeTributario } from "@/lib/types";

interface Props {
  config: ConfigEmpresa;
}

const CAMPOS_CUSTOS: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "valor_hora_mao_obra", label: "Mão de obra", sufixo: "R$/hora" },
  { nome: "valor_km_deslocamento", label: "Deslocamento", sufixo: "R$/km" },
  { nome: "valor_noite_hospedagem", label: "Hospedagem", sufixo: "R$/noite" },
  { nome: "valor_frete_por_tonelada", label: "Frete", sufixo: "R$/tonelada" },
];

// "Desconto competitivo padrão" e "Vedacit por junta" removidos deste
// formulário (pedido explícito) — ver ConfigEmpresa.desconto_competitivo/
// vedacit_gramas_por_junta (@deprecated, lib/types.ts) pra o porquê de cada
// um. As colunas continuam no banco, só não são mais editáveis aqui.
const CAMPOS_MARGEM: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "margem_lucro_padrao", label: "Margem de lucro padrão", sufixo: "% do preço de venda" },
];

// Quantificação de materiais e mão de obra automática (migração 019) — sem
// painel/senha separados: mesma tela Configurar Preços, atrás do mesmo login
// que já protege o resto do sistema (ver decisão 1 em
// sql-migration-019-motor-quantificacao-mao-obra.sql).
const CAMPOS_QUANTIFICACAO: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "isolante_acrescimo_percentual", label: "Isolante (acréscimo)", sufixo: "%" },
  { nome: "acabamento_acrescimo_percentual", label: "Acabamento (acréscimo)", sufixo: "%" },
  { nome: "rebite_por_m2", label: "Rebites por m²", sufixo: "un." },
  { nome: "parafusos_por_m2", label: "Parafusos por m²", sufixo: "un." },
  { nome: "arame_gramas_por_m2", label: "Arame por m²", sufixo: "g" },
  { nome: "silicone_intervalo_m2", label: "1 frasco de silicone a cada", sufixo: "m²" },
];

const CAMPOS_MAO_OBRA: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "m2_por_hora_dupla", label: "Base dupla", sufixo: "m²/hora" },
  { nome: "eficiencia_tubulacao_pequena", label: 'Eficiência tubulação < 4"', sufixo: "× (ex.: 0.75)" },
  { nome: "eficiencia_curva", label: "Eficiência curva", sufixo: "× (ex.: 0.75)" },
  { nome: "eficiencia_altura", label: "Eficiência altura (> 2m)", sufixo: "× (ex.: 0.50)" },
  { nome: "eficiencia_fator_br", label: "Fator de rendimento (BR)", sufixo: "× (ex.: 0.80)" },
  { nome: "horas_uteis_dia", label: "Horas úteis por dia", sufixo: "h" },
];

// Condições comerciais e projeções exibidas nas Propostas (migração 020) —
// nunca hardcoded no template do PDF/Word, ver decisão 2 em
// sql-migration-020-detalhamento-propostas.sql.
const CAMPOS_PROPOSTA: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "desconto_avista_percentual", label: "Desconto à vista", sufixo: "%" },
  { nome: "garantia_mao_obra_meses", label: "Garantia de mão de obra", sufixo: "meses" },
  { nome: "projecao_reajuste_tarifario_percentual", label: "Reajuste tarifário (projeção 10 anos)", sufixo: "% a.a." },
  { nome: "co2_kg_por_arvore_ano", label: "CO₂ absorvido por árvore", sufixo: "kg/ano" },
];

export default function FormConfigEmpresa({ config }: Props) {
  const [valores, setValores] = useState<ConfigEmpresa>(config);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const response = await fetch("/api/config-empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      setMensagem(response.ok ? "Configuração salva com sucesso." : "Erro ao salvar configuração.");
    } finally {
      setSalvando(false);
    }
  }

  function numero(nome: keyof ConfigEmpresa) {
    return (
      <input
        type="number"
        step="0.01"
        className="input-field"
        value={valores[nome] as number}
        onChange={(e) => setValores((prev) => ({ ...prev, [nome]: Number(e.target.value) }))}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <h2 className="text-lg font-semibold">Custos, impostos e margem</h2>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Regime tributário</h3>
        <p className="mb-3 text-xs text-gray-500">
          Define como o percentual de impostos "base" é calculado. Impostos extras
          (opcionais, variam por contrato) ficam na tabela de Impostos abaixo.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field">Regime</label>
            <select
              className="input-field"
              value={valores.regime_tributario}
              onChange={(e) =>
                setValores((prev) => ({ ...prev, regime_tributario: e.target.value as RegimeTributario }))
              }
            >
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="personalizado">Personalizado (só impostos da lista)</option>
            </select>
          </div>

          {valores.regime_tributario === "simples_nacional" && (
            <>
              <div>
                <label className="label-field">
                  Anexo <span className="text-gray-400">(confirme com o contador)</span>
                </label>
                <select
                  className="input-field"
                  value={valores.simples_nacional_anexo}
                  onChange={(e) =>
                    setValores((prev) => ({
                      ...prev,
                      simples_nacional_anexo: e.target.value as AnexoSimplesNacional,
                    }))
                  }
                >
                  <option value="III">Anexo III</option>
                  <option value="IV">Anexo IV</option>
                </select>
              </div>
              <div>
                <label className="label-field">RBT12 (receita bruta 12 meses)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={valores.simples_nacional_rbt12}
                  onChange={(e) =>
                    setValores((prev) => ({ ...prev, simples_nacional_rbt12: Number(e.target.value) }))
                  }
                />
              </div>
            </>
          )}
        </div>
        {valores.regime_tributario === "simples_nacional" && !valores.simples_nacional_rbt12 && (
          <p className="mt-2 text-sm text-amber-600">
            ⚠️ Sem o RBT12 preenchido, o sistema vai bloquear o cálculo de novos orçamentos.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Custos operacionais</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPOS_CUSTOS.map((campo) => (
            <div key={campo.nome}>
              <label className="label-field">
                {campo.label} <span className="text-gray-400">({campo.sufixo})</span>
              </label>
              {numero(campo.nome)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Margem</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPOS_MARGEM.map((campo) => (
            <div key={campo.nome}>
              <label className="label-field">
                {campo.label} <span className="text-gray-400">({campo.sufixo})</span>
              </label>
              {numero(campo.nome)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Quantificação de materiais</h3>
        <p className="mb-3 text-xs text-gray-500">
          Multiplicadores aplicados sobre a metragem total do trecho (m²) — ver{" "}
          <a href="/novo-orcamento/step-4-precos" className="text-brand hover:underline">
            Tela 4 do orçamento
          </a>
          .
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS_QUANTIFICACAO.map((campo) => (
            <div key={campo.nome}>
              <label className="label-field">
                {campo.label} <span className="text-gray-400">({campo.sufixo})</span>
              </label>
              {numero(campo.nome)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Mão de obra automática</h3>
        <p className="mb-3 text-xs text-gray-500">
          Substitui o campo manual "Mão de obra (horas)" — a eficiência é o produto de todos os fatores que se
          aplicam ao trecho (tubulação pequena × curva × altura × fator BR).
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPOS_MAO_OBRA.map((campo) => (
            <div key={campo.nome}>
              <label className="label-field">
                {campo.label} <span className="text-gray-400">({campo.sufixo})</span>
              </label>
              {numero(campo.nome)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-600">Propostas — condições comerciais e projeções</h3>
        <p className="mb-3 text-xs text-gray-500">
          Exibidos nas Propostas Técnica/Comercial (Condições Comerciais, Análise de Payback e Benefícios
          Ambientais). O reajuste tarifário é uma estimativa de mercado usada só na projeção de 10 anos — não altera
          o cálculo do orçamento em si.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPOS_PROPOSTA.map((campo) => (
            <div key={campo.nome}>
              <label className="label-field">
                {campo.label} <span className="text-gray-400">({campo.sufixo})</span>
              </label>
              {numero(campo.nome)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar configuração"}
        </button>
        {mensagem && <span className="text-sm text-gray-500">{mensagem}</span>}
      </div>
    </form>
  );
}
