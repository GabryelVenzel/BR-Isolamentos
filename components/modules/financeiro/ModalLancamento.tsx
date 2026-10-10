"use client";

import { useEffect, useState } from "react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { FORMAS_PAGAMENTO, LABEL_FORMA_PAGAMENTO, MAXIMO_PARCELAS, gerarParcelas, hojeBrasilia } from "@/lib/financeiro";
import { formatarMoeda } from "@/lib/format";
import type {
  AnexoLancamento,
  CategoriaLancamento,
  FormaPagamento,
  Fornecedor,
  LancamentoFinanceiro,
  Parceiro,
  Servico,
  TipoLancamentoFinanceiro,
} from "@/lib/types/domain";
import AnexosUpload from "./AnexosUpload";
import { toast } from "./toast";

interface Props {
  lancamento: LancamentoFinanceiro | null; // null = criar novo
  onFechar: () => void;
  onSalvo: () => void;
}

type Repeticao = "unico" | "parcelado" | "recorrente";

/** Lista para um <select> vinda de uma rota no formato { success, data }. */
function useLista<T>(url: string): T[] {
  const [itens, setItens] = useState<T[]>([]);
  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then((p) => p.success && setItens(p.data))
      .catch(() => setItens([]));
  }, [url]);
  return itens;
}

export default function ModalLancamento({ lancamento, onFechar, onSalvo }: Props) {
  const [tipo, setTipo] = useState<TipoLancamentoFinanceiro>(lancamento?.tipo ?? "despesa");
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? "");
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [valor, setValor] = useState(lancamento?.valor != null ? String(lancamento.valor) : "");
  const [vencimento, setVencimento] = useState(lancamento?.data ?? hojeBrasilia());
  // Competência é escolhida por MÊS (input type="month", "YYYY-MM") e gravada
  // como o dia 1 daquele mês. Enquanto o usuário não mexer nela, acompanha o
  // mês do vencimento.
  const [competencia, setCompetencia] = useState((lancamento?.data_competencia ?? lancamento?.data ?? hojeBrasilia()).slice(0, 7));
  const [competenciaManual, setCompetenciaManual] = useState(
    Boolean(lancamento?.data_competencia && lancamento.data_competencia.slice(0, 7) !== lancamento.data.slice(0, 7))
  );
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "">(lancamento?.forma_pagamento ?? "");
  const [servicoId, setServicoId] = useState(lancamento?.servico_id ?? "");
  const [fornecedorId, setFornecedorId] = useState(lancamento?.fornecedor_id ?? "");
  const [parceiroId, setParceiroId] = useState(lancamento?.parceiro_id ?? "");
  const [pago, setPago] = useState(lancamento?.pago ?? false);
  const [dataPagamento, setDataPagamento] = useState(lancamento?.data_pagamento ?? hojeBrasilia());
  const [anexos, setAnexos] = useState<AnexoLancamento[]>(lancamento?.anexos ?? []);
  const [repeticao, setRepeticao] = useState<Repeticao>("unico");
  const [quantidade, setQuantidade] = useState("2");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const categorias = useLista<CategoriaLancamento>(`/api/financeiro/categorias?tipo=${tipo}&ativo=true`);
  const servicos = useLista<Servico>("/api/operacional/servicos");
  const fornecedores = useLista<Fornecedor>("/api/operacional/fornecedores");
  const parceiros = useLista<Parceiro>("/api/operacional/parceiros");

  const despesa = tipo === "despesa";
  const n = Number(quantidade);
  const quantidadeValida = Number.isInteger(n) && n >= 2 && n <= MAXIMO_PARCELAS;

  // Trocar o tipo sem categoria ainda selecionada (fluxo de criação) limpa a
  // categoria — evita mandar uma categoria de receita presa a um lançamento
  // de despesa por engano.
  function trocarTipo(novoTipo: TipoLancamentoFinanceiro) {
    setTipo(novoTipo);
    if (!lancamento) setCategoria("");
  }

  function trocarVencimento(novo: string) {
    setVencimento(novo);
    if (!competenciaManual && novo) setCompetencia(novo.slice(0, 7));
  }

  async function salvar() {
    if (!categoria) return setErro("Selecione a categoria.");
    if (!descricao.trim()) return setErro("Descreva o lançamento.");
    if (!valor || Number(valor) <= 0) return setErro("Informe o valor.");
    if (!vencimento) return setErro("Informe o vencimento.");
    if (!competencia) return setErro("Informe o mês de competência.");
    if (!lancamento && repeticao !== "unico" && !quantidadeValida) {
      return setErro(`Informe uma quantidade entre 2 e ${MAXIMO_PARCELAS}.`);
    }
    setErro(null);
    setSalvando(true);

    const payload = {
      tipo,
      categoria,
      descricao,
      valor: Number(valor),
      data: vencimento,
      data_competencia: `${competencia}-01`,
      forma_pagamento: formaPagamento || null,
      servico_id: servicoId || null,
      // Fornecedor e parceiro só fazem sentido em despesa.
      fornecedor_id: despesa ? fornecedorId || null : null,
      parceiro_id: despesa ? parceiroId || null : null,
      pago,
      data_pagamento: pago ? dataPagamento : null,
      anexos,
      ...(!lancamento && repeticao === "parcelado" && { parcelas: n }),
      ...(!lancamento && repeticao === "recorrente" && { repetir_meses: n }),
    };

    try {
      const response = lancamento
        ? await fetch(`/api/financeiro/lancamentos/${lancamento.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/financeiro/lancamentos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const resposta = await response.json();
      if (!response.ok || !resposta.success) {
        setErro(resposta.error ?? "Erro ao salvar lançamento.");
        return;
      }

      toast.sucesso(
        lancamento
          ? "Lançamento atualizado."
          : repeticao === "unico"
            ? "Lançamento criado."
            : `${n} lançamentos criados (${repeticao === "parcelado" ? "parcelas" : "um por mês"}).`
      );
      onSalvo();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const valorParcela =
    repeticao === "parcelado" && quantidadeValida && Number(valor) > 0
      ? gerarParcelas({ descricao: "", valor: Number(valor), data: vencimento, data_competencia: vencimento }, n)[0].valor
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-lancamento"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-6 shadow-card-hover"
      >
        <h2 id="titulo-modal-lancamento" className="mb-4 font-montserrat text-lg font-bold text-brand">
          {lancamento ? "Editar Lançamento" : "Novo Lançamento"}
        </h2>

        <div className="space-y-4">
          <div>
            <p className="label-field">
              Tipo<span className="text-status-error"> *</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" aria-pressed={tipo === "receita"} className={tipo === "receita" ? "btn-accent" : "btn-secondary"} onClick={() => trocarTipo("receita")}>
                Receita
              </button>
              <button type="button" aria-pressed={despesa} className={despesa ? "btn-danger" : "btn-secondary"} onClick={() => trocarTipo("despesa")}>
                Despesa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="lanc-categoria">
                Categoria<span className="text-status-error"> *</span>
              </label>
              <select id="lanc-categoria" className="input-field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Selecione...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field" htmlFor="lanc-valor">
                Valor{repeticao === "parcelado" && !lancamento ? " total" : ""}
                <span className="text-status-error"> *</span>
              </label>
              <CampoMoeda id="lanc-valor" value={valor} onChange={setValor} />
            </div>
          </div>

          <div>
            <label className="label-field" htmlFor="lanc-descricao">
              Descrição<span className="text-status-error"> *</span>
            </label>
            <input
              id="lanc-descricao"
              className="input-field"
              placeholder='Ex.: "Chapa de alumínio", "Adiantamento inicial"...'
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label-field" htmlFor="lanc-vencimento">
                Vencimento<span className="text-status-error"> *</span>
              </label>
              <input id="lanc-vencimento" type="date" className="input-field" value={vencimento} onChange={(e) => trocarVencimento(e.target.value)} />
            </div>
            <div>
              <label className="label-field" htmlFor="lanc-competencia">
                Competência<span className="text-status-error"> *</span>
              </label>
              <input
                id="lanc-competencia"
                type="month"
                className="input-field"
                value={competencia}
                onChange={(e) => {
                  setCompetencia(e.target.value);
                  setCompetenciaManual(true);
                }}
              />
            </div>
            <div>
              <label className="label-field" htmlFor="lanc-forma">
                Forma de pagamento
              </label>
              <select id="lanc-forma" className="input-field" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento | "")}>
                <option value="">Não informada</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {LABEL_FORMA_PAGAMENTO[f]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-500">
            Vencimento é quando paga ou recebe. Competência é o mês a que o valor pertence nos relatórios de resultado.
          </p>

          <fieldset className="rounded-card border border-gray-200 p-4">
            <legend className="px-1 font-montserrat text-sm font-semibold text-brand">Ligado a</legend>
            <div className={`grid grid-cols-1 gap-4 ${despesa ? "sm:grid-cols-3" : ""}`}>
              <div>
                <label className="label-field" htmlFor="lanc-servico">
                  Obra (serviço)
                </label>
                <select id="lanc-servico" className="input-field" value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.numero_servico}
                      {s.cliente?.nome ? ` — ${s.cliente.nome}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {despesa && (
                <>
                  <div>
                    <label className="label-field" htmlFor="lanc-fornecedor">
                      Fornecedor
                    </label>
                    <select id="lanc-fornecedor" className="input-field" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
                      <option value="">Nenhum</option>
                      {fornecedores.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-field" htmlFor="lanc-parceiro">
                      Parceiro (mão de obra)
                    </label>
                    <select id="lanc-parceiro" className="input-field" value={parceiroId} onChange={(e) => setParceiroId(e.target.value)}>
                      <option value="">Nenhum</option>
                      {parceiros.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </fieldset>

          {!lancamento ? (
            <fieldset className="rounded-card border border-gray-200 p-4">
              <legend className="px-1 font-montserrat text-sm font-semibold text-brand">Repetição</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {(
                  [
                    ["unico", "Lançamento único"],
                    ["parcelado", "Parcelar o valor"],
                    ["recorrente", "Repetir todo mês"],
                  ] as Array<[Repeticao, string]>
                ).map(([valorOpcao, label]) => (
                  <label key={valorOpcao} className="flex items-center gap-2">
                    <input type="radio" name="repeticao" checked={repeticao === valorOpcao} onChange={() => setRepeticao(valorOpcao)} />
                    {label}
                  </label>
                ))}
              </div>
              {repeticao !== "unico" && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <label htmlFor="lanc-quantidade">{repeticao === "parcelado" ? "Número de parcelas" : "Por quantos meses"}</label>
                  <input
                    id="lanc-quantidade"
                    type="number"
                    min={2}
                    max={MAXIMO_PARCELAS}
                    className="input-field w-24"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                  />
                  <span className="text-xs text-gray-500">
                    {repeticao === "parcelado"
                      ? valorParcela !== null
                        ? `${n} parcelas de ${formatarMoeda(valorParcela)}, vencendo todo mês a partir do vencimento acima.`
                        : "O valor total é dividido em parcelas mensais."
                      : quantidadeValida && Number(valor) > 0
                        ? `${n} lançamentos de ${formatarMoeda(Number(valor))}, um por mês.`
                        : "O valor cheio se repete a cada mês."}
                  </span>
                </div>
              )}
            </fieldset>
          ) : (
            lancamento.grupo_id && (
              <p className="text-xs text-gray-500">
                {lancamento.grupo_tipo === "parcelado" ? "Parcela" : "Repetição"} {lancamento.parcela_numero}/{lancamento.parcela_total} — a alteração vale só para
                este lançamento.
              </p>
            )
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
            {despesa ? "Já pago" : "Já recebido"}
            {!lancamento && repeticao !== "unico" && <span className="text-xs text-gray-500">(vale só para o primeiro)</span>}
          </label>

          {pago && (
            <div className="sm:max-w-[14rem]">
              <label className="label-field" htmlFor="lanc-data-pagamento">
                Data do {despesa ? "pagamento" : "recebimento"}
              </label>
              <input id="lanc-data-pagamento" type="date" className="input-field" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>
          )}

          <AnexosUpload anexos={anexos} onChange={setAnexos} />

          {erro && (
            <p role="alert" className="text-sm text-status-error">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : lancamento ? "Salvar alterações" : "Criar lançamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
