"use client";

import { useState, type FormEvent } from "react";
import type { AnexoSimplesNacional, ConfigEmpresa, FormaContratacao, FuncaoMaoObra, ItemExecucaoPadrao, RegimeTributario } from "@/lib/types";
import { ITENS_EXECUCAO_SUGERIDOS } from "@/lib/usecases/orcamento/itensExecucao";
import { FORMAS_CONTRATACAO, LABEL_FORMA_CONTRATACAO, PARAMETROS_ENCARGOS_2026, type FaixaIrrf, type ReducaoIrrf } from "@/lib/usecases/orcamento/encargosMaoObra";
import { hojeBrasilia } from "@/lib/financeiro";
import { formatarData } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

interface Props {
  config: ConfigEmpresa;
}

// Frete removido desta lista (pedido explícito, migração 032) — na Tela 4 do
// orçamento o frete é digitado direto em R$ (não depende de nenhum preço
// configurado aqui).
const CAMPOS_CUSTOS: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "valor_km_deslocamento", label: "Deslocamento", sufixo: "R$/km" },
  { nome: "valor_noite_hospedagem", label: "Hospedagem", sufixo: "R$/noite" },
  { nome: "valor_diaria_aluguel_carro", label: "Aluguel de carro", sufixo: "R$/diária" },
  { nome: "valor_diaria_alimentacao", label: "Alimentação", sufixo: "R$/diária" },
];

// Reorganização pedida explicitamente: "Margem" (que só tinha
// margem_lucro_padrao) e a antiga "Propostas — condições comerciais e
// projeções" viraram UM subtópico "Condições comerciais" (com margem
// incluída) dentro de "Custos, impostos e margem" — Reajuste tarifário e CO₂
// absorvido saíram daqui e viraram o subtópico "Projeções", em "Parâmetros
// de Quantificação" (ver CAMPOS_PROJECOES abaixo). "Desconto competitivo
// padrão" e "Vedacit por junta" continuam fora do formulário (pedido
// explícito de rodada anterior) — ver ConfigEmpresa.desconto_competitivo/
// vedacit_gramas_por_junta (@deprecated, lib/types.ts). As colunas continuam
// no banco, só não são editáveis aqui.
const CAMPOS_CONDICOES_COMERCIAIS: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "desconto_avista_percentual", label: "Desconto à vista", sufixo: "%" },
  { nome: "garantia_mao_obra_meses", label: "Garantia de mão de obra", sufixo: "meses" },
  { nome: "validade_proposta_dias", label: "Validade da proposta", sufixo: "dias" },
  { nome: "margem_lucro_padrao", label: "Margem de lucro padrão", sufixo: "% do preço de venda" },
];

// Quantificação de materiais e mão de obra automática (migração 019) — sem
// painel/senha separados: mesma tela Configurar Preços, atrás do mesmo login
// que já protege o resto do sistema (ver decisão 1 em
// sql-migration-019-motor-quantificacao-mao-obra.sql).
const CAMPOS_QUANTIFICACAO: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "isolante_acrescimo_percentual", label: "Isolante (acréscimo sobre a área já isolada)", sufixo: "%" },
  { nome: "acabamento_acrescimo_percentual", label: "Chaparia (acréscimo sobre a área já isolada)", sufixo: "%" },
  { nome: "rebite_por_m2", label: "Rebites por m²", sufixo: "un." },
  { nome: "parafusos_por_m2", label: "Parafusos por m²", sufixo: "un." },
  { nome: "arame_metros_por_m2", label: "Arame por m²", sufixo: "m" },
  { nome: "silicone_intervalo_m2", label: "1 frasco de silicone a cada", sufixo: "m²" },
];

// Cargos da mão de obra (migrações 048 e 050) — cada um com a sua diária e,
// quando executa o isolamento, o seu rendimento. O TST só tem diária: é
// cobrado pelos mesmos dias da equipe, mas não produz. Um cargo cuja coluna
// ainda não existe no banco (migração não rodada) não aparece.
const CARGOS: Array<{ funcao: FuncaoMaoObra; label: string; diaria: keyof ConfigEmpresa; rendimento: keyof ConfigEmpresa | null }> = [
  { funcao: "funileiro", label: "Funileiro", diaria: "valor_diaria_funileiro", rendimento: "m2_dia_funileiro" },
  { funcao: "isolador", label: "Isolador", diaria: "valor_diaria_isolador", rendimento: "m2_dia_isolador" },
  { funcao: "ajudante", label: "Ajudante", diaria: "valor_diaria_ajudante", rendimento: "m2_dia_ajudante" },
  // Migração 056 — o Supervisor produz (decisão do usuário).
  { funcao: "supervisor", label: "Supervisor", diaria: "valor_diaria_supervisor", rendimento: "m2_dia_supervisor" },
  { funcao: "tst", label: "Técnico de Segurança do Trabalho (TST)", diaria: "valor_diaria_tst", rendimento: null },
];

// Encargos sobre a mão de obra (migração 056) — valores de 2026; mudam todo
// ano (teto do INSS, tabela do IR) e por isso ficam editáveis.
const CAMPOS_ENCARGOS: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "encargos_inss_pf_pct", label: "INSS descontado da pessoa física", sufixo: "%" },
  { nome: "encargos_teto_inss", label: "Teto do INSS (base mensal)", sufixo: "R$" },
  { nome: "encargos_cpp_pct", label: "INSS patronal (CPP)", sufixo: "%" },
  { nome: "encargos_irrf_desconto_simplificado", label: "IR: desconto simplificado mensal", sufixo: "R$" },
  { nome: "encargos_iss_autonomo_pct", label: "ISS sobre autônomo (se o município exigir)", sufixo: "%" },
  { nome: "encargos_dias_trabalho_mes", label: "Diárias de um mês cheio (base da pessoa física)", sufixo: "dias" },
];

const CAMPOS_MAO_OBRA: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "eficiencia_tubulacao_pequena", label: 'Eficiência tubulação < 3"', sufixo: "× (ex.: 0.75)" },
  { nome: "eficiencia_tubulacao_media", label: 'Eficiência tubulação 3"–6"', sufixo: "× (ex.: 0.85)" },
  { nome: "eficiencia_curva", label: "Eficiência curva", sufixo: "× (ex.: 0.75)" },
  { nome: "eficiencia_altura", label: "Eficiência altura (> 2m)", sufixo: "× (ex.: 0.50)" },
  { nome: "eficiencia_remocao", label: "Eficiência com remoção do isolamento existente", sufixo: "× (ex.: 0.80)" },
  { nome: "eficiencia_fator_br", label: "Fator de rendimento (BR)", sufixo: "× (ex.: 0.80)" },
  { nome: "horas_uteis_dia", label: "Horas úteis por dia (dia de trabalho)", sufixo: "h" },
];

// Projeções exibidas só na Proposta Comercial (migração 020) — nunca
// hardcoded no template do PDF/Word, ver decisão 2 em
// sql-migration-020-detalhamento-propostas.sql. Separado de "Condições
// comerciais" (pedido explícito) por ficar do lado de "Parâmetros de
// Quantificação" — não são condições negociadas com o cliente, são
// estimativas de mercado usadas só na projeção de 10 anos/benefícios
// ambientais.
const CAMPOS_PROJECOES: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }> = [
  { nome: "projecao_reajuste_tarifario_percentual", label: "Reajuste tarifário (projeção 10 anos)", sufixo: "% a.a." },
  { nome: "co2_kg_por_arvore_ano", label: "CO₂ absorvido por árvore", sufixo: "kg/ano" },
];

// Bloco de contato exibido na Proposta Técnica (migração 034, pedido
// explícito) — distinto de telefone_empresa/email_empresa (linha genérica
// "Contato: X · Y" do rodapé de ambas as Propostas): aqui é o contato
// pessoal de quem responde tecnicamente pela proposta.
const CAMPOS_CONTATO_TECNICO: Array<{ nome: keyof ConfigEmpresa; label: string; placeholder: string }> = [
  { nome: "responsavel_tecnico_nome", label: "Nome", placeholder: "Fabiano Garcia" },
  { nome: "responsavel_tecnico_cargo", label: "Cargo/posição", placeholder: "Responsável Técnico" },
  { nome: "responsavel_tecnico_whatsapp", label: "WhatsApp/telefone", placeholder: "+55 11 92113-2612" },
  { nome: "responsavel_tecnico_email", label: "E-mail", placeholder: "fabiano.garcia@br-isolamentos.com.br" },
  { nome: "cnpj", label: "CNPJ da empresa", placeholder: "64.343.539/0001-26" },
];

export default function FormConfigEmpresa({ config }: Props) {
  const [valores, setValores] = useState<ConfigEmpresa>(config);

  // Encargos (migração 056): forma padrão por função, tabela e redução do IR.
  const formasPadrao = (valores.forma_contratacao_padrao ?? {}) as Partial<Record<FuncaoMaoObra, FormaContratacao>>;
  const tabelaIrrf: FaixaIrrf[] = Array.isArray(valores.encargos_tabela_irrf) ? (valores.encargos_tabela_irrf as FaixaIrrf[]) : PARAMETROS_ENCARGOS_2026.tabela_irrf;
  const reducaoIrrf: ReducaoIrrf = { ...PARAMETROS_ENCARGOS_2026.reducao_irrf, ...((valores.encargos_reducao_irrf ?? {}) as Partial<ReducaoIrrf>) };
  const alterarFaixa = (i: number, dados: Partial<FaixaIrrf>) =>
    setValores((prev) => ({ ...prev, encargos_tabela_irrf: tabelaIrrf.map((f, j) => (j === i ? { ...f, ...dados } : f)) }));
  const alterarReducao = (dados: Partial<ReducaoIrrf>) => setValores((prev) => ({ ...prev, encargos_reducao_irrf: { ...reducaoIrrf, ...dados } }));
  const temEncargos = config.encargos_inss_pf_pct !== undefined;
  const diasDesdeRbt12 = valores.simples_nacional_rbt12_atualizado_em
    ? Math.floor((new Date(`${hojeBrasilia()}T00:00:00Z`).getTime() - new Date(`${String(valores.simples_nacional_rbt12_atualizado_em).slice(0, 10)}T00:00:00Z`).getTime()) / 86400000)
    : null;
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

  // Catálogo de itens de execução padrão (migração 051) — lista dentro da
  // própria configuração; salva junto com o resto no botão do fim da tela.
  const itensExecucao: ItemExecucaoPadrao[] = Array.isArray(valores.itens_execucao_padrao) ? valores.itens_execucao_padrao : [];
  function alterarItemExecucao(index: number, dados: Partial<ItemExecucaoPadrao>) {
    setValores((prev) => ({ ...prev, itens_execucao_padrao: itensExecucao.map((item, i) => (i === index ? { ...item, ...dados } : item)) }));
  }
  function removerItemExecucao(index: number) {
    setValores((prev) => ({ ...prev, itens_execucao_padrao: itensExecucao.filter((_, i) => i !== index) }));
  }
  function adicionarItemExecucao() {
    // O id não muda ao renomear — é por ele que um orçamento em andamento sabe o que estava marcado.
    setValores((prev) => ({ ...prev, itens_execucao_padrao: [...itensExecucao, { id: `item_${Date.now()}`, nome: "", unidade: "diária", preco: 0 }] }));
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

  function camposGrid(campos: Array<{ nome: keyof ConfigEmpresa; label: string; sufixo: string }>, colunas: string) {
    return (
      <div className={`grid grid-cols-1 gap-4 ${colunas}`}>
        {campos
          .filter((campo) => config[campo.nome] !== undefined)
          .map((campo) => (
          <div key={campo.nome}>
            <label className="label-field">
              {campo.label} <span className="text-gray-400">({campo.sufixo})</span>
            </label>
            {numero(campo.nome)}
          </div>
        ))}
      </div>
    );
  }

  function texto(nome: keyof ConfigEmpresa, placeholder: string) {
    return (
      <input
        type="text"
        className="input-field"
        value={(valores[nome] as string | null) ?? ""}
        onChange={(e) => setValores((prev) => ({ ...prev, [nome]: e.target.value || null }))}
        placeholder={placeholder}
      />
    );
  }

  function camposGridTexto(campos: Array<{ nome: keyof ConfigEmpresa; label: string; placeholder: string }>, colunas: string) {
    return (
      <div className={`grid grid-cols-1 gap-4 ${colunas}`}>
        {campos.map((campo) => (
          <div key={campo.nome}>
            <label className="label-field">{campo.label}</label>
            {texto(campo.nome, campo.placeholder)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-8">
      {/* Reorganização pedida explicitamente em 2 grupos — "Custos, impostos
          e margem" (o que entra no cálculo do orçamento em si) e "Parâmetros
          de Quantificação" (como a quantidade de material/mão de obra é
          derivada da metragem). */}
      <div className="space-y-6">
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
                      setValores((prev) => ({
                        ...prev,
                        simples_nacional_rbt12: Number(e.target.value),
                        // Migração 056 — data da última atualização (aviso após 30 dias).
                        ...(prev.simples_nacional_rbt12_atualizado_em !== undefined && { simples_nacional_rbt12_atualizado_em: hojeBrasilia() }),
                      }))
                    }
                  />
                  {valores.simples_nacional_rbt12_atualizado_em && (
                    <p className={`mt-1 text-xs ${diasDesdeRbt12 != null && diasDesdeRbt12 > 30 ? "font-semibold text-amber-700" : "text-gray-500"}`}>
                      Atualizado em {formatarData(String(valores.simples_nacional_rbt12_atualizado_em).slice(0, 10))}
                      {diasDesdeRbt12 != null && diasDesdeRbt12 > 30 && " — mais de 30 dias: revise (deve ser o esperado para o mês da nota)"}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          {valores.regime_tributario === "simples_nacional" && !valores.simples_nacional_rbt12 && (
            <p className="mt-2 text-sm text-amber-600">
              <AlertTriangle className="icone" aria-hidden /> Sem o RBT12 preenchido, o sistema vai bloquear o cálculo de novos orçamentos.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Custos operacionais</h3>
          {camposGrid(CAMPOS_CUSTOS, "sm:grid-cols-2 lg:grid-cols-4")}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Condições comerciais</h3>
          <p className="mb-3 text-xs text-gray-500">
            Exibidas nas Propostas Técnica/Comercial (Condições Comerciais) — a margem de lucro padrão também entra
            no cálculo do orçamento em si (ver "Custo total" no Resumo Financeiro).
          </p>
          {camposGrid(CAMPOS_CONDICOES_COMERCIAIS, "sm:grid-cols-2 lg:grid-cols-4")}
          <div className="mt-4">
            <label className="label-field">Forma de pagamento padrão</label>
            <input
              type="text"
              className="input-field"
              value={valores.forma_pagamento_padrao}
              onChange={(e) => setValores((prev) => ({ ...prev, forma_pagamento_padrao: e.target.value }))}
              placeholder="50% de entrada + 50% na conclusão dos trabalhos"
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Contato técnico (Proposta Técnica)</h3>
          <p className="mb-3 text-xs text-gray-500">
            Exibido num bloco de destaque na Proposta Técnica — o contato pessoal de quem responde tecnicamente pela
            proposta (WhatsApp/e-mail direto), além do CNPJ da empresa. O bloco só aparece se "Nome" estiver
            preenchido.
          </p>
          {camposGridTexto(CAMPOS_CONTATO_TECNICO, "sm:grid-cols-2 lg:grid-cols-3")}
        </div>
      </div>

      {/* Mão de obra — seção própria (pedido explícito): só o que é de mão
          de obra, cargos com diária e rendimento + eficiência e jornada. */}
      <div className="space-y-6 border-t border-gray-100 pt-8">
        <div>
          <h2 className="text-lg font-semibold">Mão de Obra</h2>
          <p className="text-sm text-gray-500">
            A mão de obra do orçamento é por equipe e por diária: em cada orçamento você escolhe quantas pessoas de cada cargo, e todos
            são cobrados pelos mesmos dias fechados de obra.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Cargos</h3>
          <p className="mb-3 text-xs text-gray-500">
            "Diária" é o valor combinado (LÍQUIDO, o que a pessoa recebe) de UMA pessoa do cargo por dia — os encargos de cada forma de
            contratação são calculados no orçamento, que mostra o custo real. "Rendimento" é quanto UMA pessoa produz em um dia de
            trabalho, a 100% de eficiência — a produção da equipe é a soma das pessoas escolhidas. O Técnico de Segurança do Trabalho
            acompanha a obra e entra no custo, mas não produz. "Contratação padrão" vem preenchida em cada linha da equipe (dá para
            trocar no orçamento).
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="table-header">
                <tr>
                  <th className="py-2 pr-4 text-left">Cargo</th>
                  <th className="py-2 pr-4 text-left">Diária combinada (R$ líquido por pessoa por dia)</th>
                  <th className="py-2 pr-4 text-left">Rendimento (m² por pessoa por dia)</th>
                  {valores.forma_contratacao_padrao !== undefined && <th className="py-2 text-left">Contratação padrão</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {CARGOS.filter((cargo) => config[cargo.diaria] !== undefined).map((cargo) => (
                  <tr key={cargo.diaria}>
                    <td className="py-2 pr-4 font-medium">{cargo.label}</td>
                    <td className="py-2 pr-4">
                      <div className="max-w-[12rem]">{numero(cargo.diaria)}</div>
                    </td>
                    <td className="py-2 pr-4">
                      {cargo.rendimento && config[cargo.rendimento] !== undefined ? (
                        <div className="max-w-[12rem]">{numero(cargo.rendimento)}</div>
                      ) : (
                        <span className="text-gray-400">Não produz</span>
                      )}
                    </td>
                    {valores.forma_contratacao_padrao !== undefined && (
                      <td className="py-2">
                        <select
                          aria-label={`Contratação padrão de ${cargo.label}`}
                          className="input-field max-w-[13rem]"
                          value={formasPadrao[cargo.funcao] ?? "pf"}
                          onChange={(e) => setValores((prev) => ({ ...prev, forma_contratacao_padrao: { ...formasPadrao, [cargo.funcao]: e.target.value } }))}
                        >
                          {FORMAS_CONTRATACAO.map((f) => (
                            <option key={f} value={f}>
                              {LABEL_FORMA_CONTRATACAO[f]}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {temEncargos && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-600">Encargos sobre a mão de obra</h3>
            <p className="mb-3 text-xs text-gray-500">
              A diária de cada cargo é o valor <strong>combinado</strong> (o que a pessoa recebe). MEI e PJ: custo igual ao combinado. Pessoa
              física (RPA): a BR paga um bruto maior e desconta/recolhe INSS e IR; fora do Simples Anexo III paga ainda o INSS patronal sobre
              o bruto. MEI com INSS patronal (hidráulica, eletricidade, pintura, alvenaria, carpintaria — LC 123/2006, art. 18-B): +CPP. A
              pessoa física é calculada sempre pelo mês cheio: cada diária custa o mesmo que num mês completo, mesmo em obra curta. Valores de 2026 — revise a cada ano e confirme com o contador.
            </p>
            {camposGrid(CAMPOS_ENCARGOS, "sm:grid-cols-2 lg:grid-cols-3")}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <p className="label-field">Tabela mensal do IR (sem dependentes)</p>
                <table className="min-w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="py-1.5 pr-2 text-left">Base até (R$)</th>
                      <th className="py-1.5 pr-2 text-left">Alíquota (%)</th>
                      <th className="py-1.5 text-left">Parcela a deduzir (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tabelaIrrf.map((f, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-2">
                          {f.ate === null ? (
                            <span className="text-gray-500">acima</span>
                          ) : (
                            <input type="number" step="0.01" aria-label="Base até" className="input-field" value={f.ate} onChange={(e) => alterarFaixa(i, { ate: Number(e.target.value) })} />
                          )}
                        </td>
                        <td className="py-1 pr-2">
                          <input type="number" step="0.01" aria-label="Alíquota" className="input-field" value={f.aliquota} onChange={(e) => alterarFaixa(i, { aliquota: Number(e.target.value) })} />
                        </td>
                        <td className="py-1">
                          <input type="number" step="0.01" aria-label="Parcela a deduzir" className="input-field" value={f.deducao} onChange={(e) => alterarFaixa(i, { deducao: Number(e.target.value) })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={reducaoIrrf.ativa} onChange={(e) => alterarReducao({ ativa: e.target.checked })} />
                  Aplicar a redução do IR da Lei 15.270/2025
                </label>
                <p className="text-xs text-gray-500">
                  Rendimento do mês até o limite de isenção: IR zerado. Até o limite de redução: redução = constante − coeficiente × rendimento.
                  O rendimento usado é o bruto do mês (confirmar com o contador).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["isencao_ate", "Isenção até (R$)"],
                      ["reducao_ate", "Redução até (R$)"],
                      ["constante", "Constante (R$)"],
                      ["coeficiente", "Coeficiente"],
                    ] as const
                  ).map(([chave, label]) => (
                    <div key={chave}>
                      <label className="label-field">{label}</label>
                      <input
                        type="number"
                        step="any"
                        className="input-field"
                        disabled={!reducaoIrrf.ativa}
                        value={reducaoIrrf[chave]}
                        onChange={(e) => alterarReducao({ [chave]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Eficiência e jornada</h3>
          <p className="mb-3 text-xs text-gray-500">
            A metragem de cada trecho é dividida pela eficiência (diâmetro da tubulação × curva × altura × fator BR — acima de 6" a
            eficiência de diâmetro é 1, entre 3" e 6" usa "Eficiência tubulação 3"–6"", abaixo de 3" usa "Eficiência tubulação &lt; 3"")
            e o resultado vira horas de obra. Um trecho marcado com remoção do isolamento existente também é multiplicado pelo fator de
            remoção. As horas são sempre arredondadas para cima em dias fechados de "Horas úteis por dia".
            Cada orçamento pode ajustar as horas úteis na etapa "Equipe e custos", quando deslocamento ou liberação de acesso reduzem
            o tempo produtivo.
          </p>
          {camposGrid(CAMPOS_MAO_OBRA, "sm:grid-cols-2 lg:grid-cols-3")}
        </div>

        {/* Catálogo de itens de execução padrão (migração 051). */}
        {config.itens_execucao_padrao !== undefined && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-600">Itens de execução padrão</h3>
            <p className="mb-3 text-xs text-gray-500">
              Equipamentos e serviços de apoio que se repetem de obra em obra. Em cada orçamento (etapa "Equipe e custos") basta marcar o
              que a obra inclui: os marcados entram no custo e em "O orçamento contempla" na proposta; os não marcados são citados em
              "Não contemplado". O preço aqui é o padrão — dá para ajustar em cada orçamento.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="table-header">
                  <tr>
                    <th className="py-2 pr-4 text-left">Item</th>
                    <th className="py-2 pr-4 text-left">Unidade</th>
                    <th className="py-2 pr-4 text-left">Preço padrão (R$)</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itensExecucao.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-1.5 pr-4">
                        <input className="input-field" aria-label="Nome do item" value={item.nome} onChange={(e) => alterarItemExecucao(index, { nome: e.target.value })} />
                      </td>
                      <td className="py-1.5 pr-4">
                        <input
                          className="input-field w-28"
                          aria-label="Unidade"
                          placeholder="diária, un., verba"
                          value={item.unidade}
                          onChange={(e) => alterarItemExecucao(index, { unidade: e.target.value })}
                        />
                      </td>
                      <td className="py-1.5 pr-4">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="input-field w-32"
                          aria-label="Preço padrão"
                          value={item.preco}
                          onChange={(e) => alterarItemExecucao(index, { preco: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <button type="button" className="text-status-error hover:underline" onClick={() => removerItemExecucao(index)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className="btn-secondary" onClick={adicionarItemExecucao}>
                + Adicionar item
              </button>
              {itensExecucao.length === 0 && (
                <button type="button" className="btn-secondary" onClick={() => setValores((prev) => ({ ...prev, itens_execucao_padrao: ITENS_EXECUCAO_SUGERIDOS }))}>
                  Usar a lista sugerida
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6 border-t border-gray-100 pt-8">
        <h2 className="text-lg font-semibold">Parâmetros de Quantificação</h2>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Quantificação de materiais</h3>
          <p className="mb-3 text-xs text-gray-500">
            Isolante e chaparia (acabamento) são calculados sobre a área da superfície JÁ ISOLADA — diâmetro do
            tubo/curva mais 2 espessuras de isolante, não a área do tubo nu (migração 023, mais precisa que só aplicar
            um acréscimo sobre a metragem de projeto). Rebite/parafuso/arame/silicone continuam proporcionais à
            metragem de projeto do trecho, como antes — ver{" "}
            <a href="/novo-orcamento/step-4-precos" className="text-brand hover:underline">
              Tela 4 do orçamento
            </a>
            .
          </p>
          {camposGrid(CAMPOS_QUANTIFICACAO, "sm:grid-cols-2 lg:grid-cols-3")}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-600">Projeções</h3>
          <p className="mb-3 text-xs text-gray-500">
            Usadas só na Proposta Comercial — reajuste tarifário é uma estimativa de mercado pra projeção de economia
            de 10 anos; CO₂ absorvido converte o CO₂ evitado em "árvores plantadas" nos Benefícios Ambientais. Nenhum
            dos dois altera o cálculo do orçamento em si.
          </p>
          {camposGrid(CAMPOS_PROJECOES, "sm:grid-cols-2")}
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
