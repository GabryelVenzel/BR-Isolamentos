"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown, Trash2, Undo2 } from "lucide-react";
import { confirmar } from "@/components/ui/confirmar";
import { hojeBrasilia } from "@/lib/financeiro";
import { formatarData, formatarNumero } from "@/lib/format";
import { baixarPdf } from "@/lib/pdf-generator";
import { EPIS_SUGERIDOS } from "@/lib/rh";
import type { Funcionario, FuncionarioEpi } from "@/lib/types/domain";
import { toast } from "./toast";

interface Props {
  funcionario: Pick<Funcionario, "id" | "nome" | "cpf" | "cargo" | "data_admissao" | "numero_funcionario">;
}

/** Aba "EPI" da ficha (migração 052): entregas de EPI ao funcionário — item,
 * CA, quantidade, entrega e devolução — e a ficha de EPI em PDF para
 * assinatura (NR-6). */
export default function EpisFuncionario({ funcionario }: Props) {
  const [entregas, setEntregas] = useState<FuncionarioEpi[] | null>(null);
  const [form, setForm] = useState({ item: "", ca: "", quantidade: "1", data_entrega: hojeBrasilia(), observacao: "" });
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const base = `/api/rh/funcionarios/${funcionario.id}/epis`;

  const carregar = useCallback(async () => {
    const r = await fetch(base).then((x) => x.json()).catch(() => null);
    setEntregas(r?.success ? r.data : []);
  }, [base]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registrar() {
    if (!form.item.trim()) return toast.erro("Informe o EPI.");
    setSalvando(true);
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: form.item.trim(),
          ca: form.ca.trim() || null,
          quantidade: Number(form.quantidade) || 1,
          data_entrega: form.data_entrega,
          observacao: form.observacao.trim() || null,
        }),
      }).then((x) => x.json());
      if (!r.success) return toast.erro(r.error ?? "Não foi possível registrar a entrega.");
      toast.sucesso("Entrega registrada.");
      setForm((f) => ({ ...f, item: "", ca: "", quantidade: "1", observacao: "" }));
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function devolver(epi: FuncionarioEpi) {
    const r = await fetch(`${base}?epi=${epi.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data_devolucao: hojeBrasilia() }),
    }).then((x) => x.json());
    if (!r.success) return toast.erro(r.error ?? "Não foi possível registrar a devolução.");
    toast.sucesso("Devolução registrada.");
    carregar();
  }

  async function remover(epi: FuncionarioEpi) {
    if (!(await confirmar(`Apagar a entrega de "${epi.item}" de ${formatarData(epi.data_entrega)}?`))) return;
    const r = await fetch(`${base}?epi=${epi.id}`, { method: "DELETE" }).then((x) => x.json());
    if (!r.success) return toast.erro(r.error ?? "Não foi possível apagar.");
    carregar();
  }

  async function gerarFicha() {
    if (!entregas) return;
    setGerando(true);
    try {
      const config = await fetch("/api/config-empresa").then((x) => x.json()).catch(() => null);
      const [{ pdf }, { default: FichaEpiDocument }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/pdf-native/FichaEpiDocument")]);
      const blob = await pdf(
        <FichaEpiDocument
          empresa={{ nome: config?.nome_empresa || "BR Isolamentos", cnpj: config?.cnpj ?? null }}
          funcionario={funcionario}
          entregas={entregas}
        />
      ).toBlob();
      baixarPdf(blob, `Ficha_EPI_${funcionario.nome.replace(/\s+/g, "_")}.pdf`);
    } catch {
      toast.erro("Não foi possível gerar a ficha de EPI.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Registrar entrega de EPI</h2>
          <button type="button" className="btn-secondary" onClick={gerarFicha} disabled={gerando || !entregas}>
            <FileDown className="icone mr-2" aria-hidden />
            {gerando ? "Gerando..." : "Gerar ficha de EPI (PDF)"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_0.7fr_1fr_auto] lg:items-end">
          <div>
            <label className="label-field">EPI</label>
            <input className="input-field" list="epis-sugeridos" placeholder="Ex.: Capacete com jugular" value={form.item} onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))} />
            <datalist id="epis-sugeridos">
              {[...new Set([...EPIS_SUGERIDOS, ...(entregas ?? []).map((e) => e.item)])].map((nome) => (
                <option key={nome} value={nome} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label-field">CA</label>
            <input className="input-field" placeholder="Nº do CA" value={form.ca} onChange={(e) => setForm((f) => ({ ...f, ca: e.target.value }))} />
          </div>
          <div>
            <label className="label-field">Qtd.</label>
            <input type="number" min={1} step="1" className="input-field" value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} />
          </div>
          <div>
            <label className="label-field">Entrega</label>
            <input type="date" className="input-field" value={form.data_entrega} onChange={(e) => setForm((f) => ({ ...f, data_entrega: e.target.value }))} />
          </div>
          <button type="button" className="btn-primary" onClick={registrar} disabled={salvando}>
            {salvando ? "Salvando..." : "Registrar"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          A ficha em PDF lista as entregas com espaço para a assinatura do funcionário e a declaração de recebimento — imprima, colha a
          assinatura e anexe a versão assinada em Documentos.
        </p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="tabela-cartoes w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-2 text-left">Entrega</th>
              <th className="px-4 py-2 text-left">EPI</th>
              <th className="px-4 py-2 text-left">CA</th>
              <th className="px-4 py-2 text-right">Qtd.</th>
              <th className="px-4 py-2 text-left">Devolução</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(entregas ?? []).map((epi) => (
              <tr key={epi.id}>
                <td data-label="Entrega" className="px-4 py-2">{formatarData(epi.data_entrega)}</td>
                <td data-label="EPI" className="px-4 py-2 font-medium text-brand">{epi.item}</td>
                <td data-label="CA" className="px-4 py-2 text-gray-500">{epi.ca ?? "—"}</td>
                <td data-label="Qtd." className="px-4 py-2 text-right">{formatarNumero(epi.quantidade, Number.isInteger(epi.quantidade) ? 0 : 2)}</td>
                <td data-label="Devolução" className="px-4 py-2 text-gray-500">{epi.data_devolucao ? formatarData(epi.data_devolucao) : "Em uso"}</td>
                <td data-label="Ações" className="px-4 py-2">
                  <div className="flex items-center justify-end gap-3 text-xs">
                    {!epi.data_devolucao && (
                      <button type="button" className="text-brand hover:underline" onClick={() => devolver(epi)}>
                        <Undo2 className="icone" aria-hidden /> Devolvido hoje
                      </button>
                    )}
                    <button type="button" className="hover:opacity-70" title="Apagar" aria-label="Apagar" onClick={() => remover(epi)}>
                      <Trash2 className="icone" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {entregas && entregas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Nenhuma entrega registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {!entregas && <p className="p-4 text-sm text-gray-500">Carregando...</p>}
      </div>
    </div>
  );
}
