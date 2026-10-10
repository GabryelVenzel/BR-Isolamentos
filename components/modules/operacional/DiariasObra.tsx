"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import { confirmar } from "@/components/ui/confirmar";
import { LABEL_PERIODO_DIARIA, PERIODOS_DIARIA, type ResumoDiarias } from "@/lib/compras";
import type { DocumentoVencidoDeFuncionario, DocumentoVencidoDeParceiro, FuncionarioParaObra } from "@/lib/contexts/compras";
import { hojeBrasilia } from "@/lib/financeiro";
import { formatarData, formatarMoeda } from "@/lib/format";
import type { Diaria, Parceiro, PeriodoDiaria } from "@/lib/types/domain";
import { TIPOS_TRABALHO_OPCOES } from "./MultiSelectTiposTrabalho";
import { toast } from "./toast";

interface Props {
  servicoId: string;
}

// `trabalhador` guarda quem trabalhou como "p:<id do parceiro>" ou "f:<id do funcionário>".
const formInicial = () => ({ trabalhador: "", data: hojeBrasilia(), periodo: "integral" as PeriodoDiaria, pessoas: "1", funcao: "", valor: "", observacoes: "" });

/** Aba "Diárias" do detalhe de um serviço: apontamento de mão de obra por
 * dia (parceiro ou funcionário da equipe própria, período, pessoas, função
 * e valor) e o total por pessoa/parceiro.
 * É um REGISTRO do que foi trabalhado — não gera conta a pagar sozinho; o
 * pagamento continua sendo lançado na aba Financeiro da obra. */
export default function DiariasObra({ servicoId }: Props) {
  const [diarias, setDiarias] = useState<Diaria[] | null>(null);
  const [resumo, setResumo] = useState<ResumoDiarias | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [vencidos, setVencidos] = useState<DocumentoVencidoDeParceiro[]>([]);
  const [funcionarios, setFuncionarios] = useState<FuncionarioParaObra[]>([]);
  const [vencidosFuncionarios, setVencidosFuncionarios] = useState<DocumentoVencidoDeFuncionario[]>([]);
  const [form, setForm] = useState(formInicial);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/diarias`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível carregar as diárias.");
        return;
      }
      setDiarias(payload.data.diarias);
      setResumo(payload.data.resumo);
    } catch {
      setErro("Erro de conexão ao carregar as diárias.");
    }
  }, [servicoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    // Só quem fornece mão de obra — parceiro que é apenas canal de indicação não trabalha em obra.
    fetch("/api/operacional/parceiros?ativo=true&capacidade=mao_de_obra")
      .then((r) => r.json())
      .then((p) => p.success && setParceiros(p.data))
      .catch(() => undefined);
    fetch("/api/operacional/parceiros/documentos-vencidos")
      .then((r) => r.json())
      .then((p) => p.success && setVencidos(p.data))
      .catch(() => undefined);
    fetch("/api/operacional/funcionarios")
      .then((r) => r.json())
      .then((p) => {
        if (!p.success) return;
        setFuncionarios(p.data.funcionarios);
        setVencidosFuncionarios(p.data.documentosVencidos);
      })
      .catch(() => undefined);
  }, []);

  const [tipoTrabalhador, idTrabalhador] = form.trabalhador ? form.trabalhador.split(":") : ["", ""];
  const ehFuncionario = tipoTrabalhador === "f";
  const vencidosDoParceiro: Array<{ nome: string; validade: string }> = ehFuncionario
    ? vencidosFuncionarios.filter((d) => d.funcionarioId === idTrabalhador)
    : vencidos.filter((d) => d.parceiroId === idTrabalhador);

  async function apontar() {
    if (!form.trabalhador) return setErroForm("Selecione quem trabalhou.");
    if (!form.data) return setErroForm("Informe a data.");
    if (!Number.isInteger(Number(form.pessoas)) || Number(form.pessoas) < 1) return setErroForm("Informe quantas pessoas trabalharam.");
    setErroForm(null);

    // Documentação vencida não impede o apontamento (o trabalho já aconteceu),
    // mas exige uma confirmação consciente.
    if (vencidosDoParceiro.length > 0) {
      const seguir = await confirmar(
        `${ehFuncionario ? "Este funcionário" : "Este parceiro"} tem ${vencidosDoParceiro.length === 1 ? "documento vencido" : "documentos vencidos"}: ${vencidosDoParceiro.map((d) => d.nome).join(", ")}. Apontar a diária mesmo assim?`,
        { titulo: "Documentação vencida", confirmarLabel: "Apontar mesmo assim", perigo: false }
      );
      if (!seguir) return;
    }

    setSalvando(true);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/diarias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parceiro_id: ehFuncionario ? null : idTrabalhador,
          funcionario_id: ehFuncionario ? idTrabalhador : null,
          data: form.data,
          periodo: form.periodo,
          pessoas: Number(form.pessoas),
          funcao: form.funcao.trim() || null,
          valor: Number(form.valor) || 0,
          observacoes: form.observacoes.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErroForm(payload.error ?? "Não foi possível apontar a diária.");
        return;
      }
      toast.sucesso("Diária apontada.");
      // Mantém quem trabalhou, função e valor: o próximo apontamento costuma ser igual, em outro dia.
      setForm((f) => ({ ...f, observacoes: "" }));
      carregar();
    } catch {
      setErroForm("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(diaria: Diaria) {
    if (!(await confirmar(`Excluir o apontamento de ${formatarData(diaria.data)} (${diaria.parceiro?.nome ?? diaria.funcionario?.nome ?? "sem nome"})?`))) return;
    const response = await fetch(`/api/operacional/servicos/${servicoId}/diarias?diaria=${diaria.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      toast.erro(payload.error ?? "Não foi possível excluir o apontamento.");
      return;
    }
    toast.sucesso("Apontamento excluído.");
    carregar();
  }

  if (erro) {
    return (
      <div className="text-sm text-status-error">
        <p>{erro}</p>
        <button type="button" className="btn-secondary mt-3" onClick={carregar}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!diarias || !resumo) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-card border border-gray-200 bg-gray-50 p-4">
        <h3 className="font-montserrat text-xs font-bold uppercase text-brand">Apontar diária</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="diaria-parceiro">
              Quem trabalhou<span className="text-status-error"> *</span>
            </label>
            <select id="diaria-parceiro" className="input-field" value={form.trabalhador} onChange={(e) => setForm((f) => ({ ...f, trabalhador: e.target.value }))}>
              <option value="">Selecione...</option>
              {funcionarios.length > 0 && (
                <optgroup label="Equipe própria (funcionários)">
                  {funcionarios.map((f) => (
                    <option key={f.id} value={`f:${f.id}`}>
                      {f.nome}
                      {f.cargo ? ` — ${f.cargo}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Parceiros">
                {parceiros.map((p) => (
                  <option key={p.id} value={`p:${p.id}`}>
                    {p.nome}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="diaria-funcao">
              Função
            </label>
            <select id="diaria-funcao" className="input-field" value={form.funcao} onChange={(e) => setForm((f) => ({ ...f, funcao: e.target.value }))}>
              <option value="">Não informada</option>
              {TIPOS_TRABALHO_OPCOES.map((o) => (
                <option key={o.valor} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="diaria-data">
              Data<span className="text-status-error"> *</span>
            </label>
            <input id="diaria-data" type="date" className="input-field" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
          </div>
          <div>
            <label className="label-field" htmlFor="diaria-periodo">
              Período
            </label>
            <select id="diaria-periodo" className="input-field" value={form.periodo} onChange={(e) => setForm((f) => ({ ...f, periodo: e.target.value as PeriodoDiaria }))}>
              {PERIODOS_DIARIA.map((p) => (
                <option key={p} value={p}>
                  {LABEL_PERIODO_DIARIA[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="diaria-pessoas">
              Pessoas<span className="text-status-error"> *</span>
            </label>
            <input id="diaria-pessoas" type="number" min={1} className="input-field" value={form.pessoas} onChange={(e) => setForm((f) => ({ ...f, pessoas: e.target.value }))} />
          </div>
          <div>
            <label className="label-field" htmlFor="diaria-valor">
              Valor total do apontamento
            </label>
            <CampoMoeda id="diaria-valor" value={form.valor} onChange={(v) => setForm((f) => ({ ...f, valor: v }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field" htmlFor="diaria-obs">
              Observações
            </label>
            <input id="diaria-obs" className="input-field" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>

        {vencidosDoParceiro.length > 0 && (
          <p className="flex items-start gap-2 rounded-input bg-red-50 px-3 py-2 text-xs text-status-error">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Documentação vencida: {vencidosDoParceiro.map((d) => `${d.nome} (${formatarData(d.validade)})`).join(", ")}. Regularize em{" "}
              {ehFuncionario ? "RH → Funcionários" : "Operacional → Parceiros"}.
            </span>
          </p>
        )}
        {erroForm && (
          <p role="alert" className="text-sm text-status-error">
            {erroForm}
          </p>
        )}
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={apontar} disabled={salvando}>
            {salvando ? "Salvando..." : "Apontar diária"}
          </button>
        </div>
      </div>

      {resumo.porParceiro.length > 0 && (
        <div className="rounded-card border border-gray-200 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-montserrat text-xs font-bold uppercase text-brand">Resumo</h3>
            <p className="text-gray-600">
              {resumo.pessoasDia} pessoa{resumo.pessoasDia === 1 ? "" : "s"}-período · <strong className="text-brand">{formatarMoeda(resumo.total)}</strong>
            </p>
          </div>
          <ul className="space-y-1">
            {resumo.porParceiro.map((p) => (
              <li key={p.parceiroId} className="flex items-center justify-between text-gray-700">
                <span>
                  {p.parceiro}{" "}
                  <span className="text-xs text-gray-500">
                    — {p.proprio ? "equipe própria, " : ""}
                    {p.apontamentos} apontamento{p.apontamentos === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="font-medium">{formatarMoeda(p.valor)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">O valor apontado é um registro: o pagamento é lançado na aba Financeiro da obra.</p>
        </div>
      )}

      {diarias.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma diária apontada nesta obra ainda.</p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {diarias.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p>
                  <span className="font-medium text-gray-900">{formatarData(d.data)}</span> · {LABEL_PERIODO_DIARIA[d.periodo]} · {d.parceiro?.nome ?? d.funcionario?.nome ?? "—"}
                  {d.funcionario_id && <span className="text-xs text-gray-500"> (equipe própria)</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {[`${d.pessoas} pessoa${d.pessoas === 1 ? "" : "s"}`, d.funcao, d.observacoes].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-medium text-gray-900">{d.valor > 0 ? formatarMoeda(d.valor) : "—"}</span>
                <button type="button" className="p-1 text-status-error hover:opacity-70" title="Excluir apontamento" aria-label="Excluir apontamento" onClick={() => excluir(d)}>
                  <Trash2 className="icone" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
