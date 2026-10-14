"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { confirmar } from "@/components/ui/confirmar";
import { hojeBrasilia } from "@/lib/financeiro";
import { formatarData } from "@/lib/format";
import { LABEL_AUSENCIA, TIPOS_AUSENCIA, diasDeAusencia, type TipoAusencia } from "@/lib/rh";
import type { FuncionarioAusencia } from "@/lib/types/domain";
import { toast } from "./toast";

/** Aba "Férias e afastamentos" da ficha (migração 052). Nesses dias o
 * funcionário não conta como disponível na capacidade (Operacional → Agenda)
 * e aparece como ausente ao ser alocado numa obra. */
export default function AusenciasFuncionario({ funcionarioId }: { funcionarioId: string }) {
  const [ausencias, setAusencias] = useState<FuncionarioAusencia[] | null>(null);
  const [form, setForm] = useState({ tipo: "ferias" as TipoAusencia, inicio: hojeBrasilia(), fim: hojeBrasilia(), observacao: "" });
  const [salvando, setSalvando] = useState(false);
  const base = `/api/rh/funcionarios/${funcionarioId}/ausencias`;
  const hoje = hojeBrasilia();

  const carregar = useCallback(async () => {
    const r = await fetch(base).then((x) => x.json()).catch(() => null);
    setAusencias(r?.success ? r.data : []);
  }, [base]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registrar() {
    if (form.fim < form.inicio) return toast.erro("O fim não pode ser antes do início.");
    setSalvando(true);
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, observacao: form.observacao.trim() || null }),
      }).then((x) => x.json());
      if (!r.success) return toast.erro(r.error ?? "Não foi possível registrar.");
      toast.sucesso(`${LABEL_AUSENCIA[form.tipo]} registrado.`);
      setForm((f) => ({ ...f, observacao: "" }));
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function remover(a: FuncionarioAusencia) {
    if (!(await confirmar(`Apagar ${LABEL_AUSENCIA[a.tipo].toLowerCase()} de ${formatarData(a.inicio)} a ${formatarData(a.fim)}?`))) return;
    const r = await fetch(`${base}?ausencia=${a.id}`, { method: "DELETE" }).then((x) => x.json());
    if (!r.success) return toast.erro(r.error ?? "Não foi possível apagar.");
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Registrar férias ou afastamento</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] lg:items-end">
          <div>
            <label className="label-field">Tipo</label>
            <select className="input-field" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoAusencia }))}>
              {TIPOS_AUSENCIA.map((t) => (
                <option key={t} value={t}>
                  {LABEL_AUSENCIA[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Início</label>
            <input type="date" className="input-field" value={form.inicio} onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value, fim: f.fim < e.target.value ? e.target.value : f.fim }))} />
          </div>
          <div>
            <label className="label-field">Fim</label>
            <input type="date" className="input-field" value={form.fim} onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))} />
          </div>
          <div>
            <label className="label-field">Observação</label>
            <input className="input-field" placeholder="Ex.: CID, período aquisitivo..." value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} />
          </div>
          <button type="button" className="btn-primary" onClick={registrar} disabled={salvando}>
            {salvando ? "Salvando..." : "Registrar"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Nesses dias o funcionário sai da capacidade disponível (Operacional → Agenda) e aparece como ausente ao ser alocado numa obra. O
          atestado em si pode ser anexado em Documentos.
        </p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="tabela-cartoes w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Período</th>
              <th className="px-4 py-2 text-right">Dias</th>
              <th className="px-4 py-2 text-left">Observação</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(ausencias ?? []).map((a) => {
              const emCurso = a.inicio <= hoje && a.fim >= hoje;
              return (
                <tr key={a.id}>
                  <td data-label="Tipo" className="px-4 py-2 font-medium text-brand">
                    {LABEL_AUSENCIA[a.tipo]}
                    {emCurso && <span className="badge ml-2 bg-secondary-light text-brand">Em curso</span>}
                  </td>
                  <td data-label="Período" className="px-4 py-2">
                    {formatarData(a.inicio)} a {formatarData(a.fim)}
                  </td>
                  <td data-label="Dias" className="px-4 py-2 text-right">{diasDeAusencia(a.inicio, a.fim)}</td>
                  <td data-label="Observação" className="px-4 py-2 text-gray-500">{a.observacao ?? "—"}</td>
                  <td data-label="Ações" className="px-4 py-2 text-right">
                    <button type="button" className="hover:opacity-70" title="Apagar" aria-label="Apagar" onClick={() => remover(a)}>
                      <Trash2 className="icone" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
            {ausencias && ausencias.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  Nenhum período registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {!ausencias && <p className="p-4 text-sm text-gray-500">Carregando...</p>}
      </div>
    </div>
  );
}
