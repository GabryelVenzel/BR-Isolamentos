"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertOctagon, AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { LABEL_MODULO } from "@/lib/acesso";
import type { CentralDeAlertas } from "@/lib/contexts/alertas";
import { toast } from "@/components/ui/toast";

interface Props {
  /** Administrador pode alterar os prazos de antecedência. */
  admin: boolean;
}

const INTERVALO_ATUALIZACAO_MS = 5 * 60 * 1000;

/** Sino da barra superior: quantidade de pendências e, ao abrir, a lista —
 * só dos módulos liberados para o usuário (ver lib/contexts/alertas.ts).
 * Recalcula ao trocar de tela e a cada 5 minutos com a aba aberta. */
export default function SinoAlertas({ admin }: Props) {
  const pathname = usePathname();
  const [central, setCentral] = useState<CentralDeAlertas | null>(null);
  const [aberto, setAberto] = useState(false);
  const [editandoPrazos, setEditandoPrazos] = useState(false);
  const [diasContas, setDiasContas] = useState("7");
  const [diasDocumentos, setDiasDocumentos] = useState("30");
  const [salvando, setSalvando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const response = await fetch("/api/alertas");
      const payload = await response.json();
      if (response.ok && payload.success) {
        setCentral(payload.data);
        setDiasContas(String(payload.data.config.dias_contas_a_vencer));
        setDiasDocumentos(String(payload.data.config.dias_documentos_a_vencer));
      }
    } catch {
      // Sino é acessório: sem conexão, simplesmente não atualiza.
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar, pathname]);

  useEffect(() => {
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  async function salvarPrazos() {
    setSalvando(true);
    try {
      const response = await fetch("/api/alertas/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias_contas_a_vencer: Number(diasContas), dias_documentos_a_vencer: Number(diasDocumentos) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível salvar os prazos.");
        return;
      }
      toast.sucesso("Prazos dos alertas atualizados.");
      setEditandoPrazos(false);
      carregar();
    } catch {
      toast.erro("Erro de conexão ao salvar os prazos.");
    } finally {
      setSalvando(false);
    }
  }

  const alertas = central?.alertas ?? [];
  const criticos = alertas.filter((a) => a.severidade === "critico").length;

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-label={alertas.length === 0 ? "Pendências: nenhuma" : `Pendências: ${alertas.length}`}
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => setAberto((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {alertas.length > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 font-montserrat text-[10px] font-bold ${
              criticos > 0 ? "bg-status-error text-white" : "bg-secondary text-brand"
            }`}
          >
            {alertas.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed inset-x-2 top-[64px] z-[80] max-h-[75vh] overflow-y-auto rounded-card border border-gray-200 bg-white text-gray-900 shadow-card-hover sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="font-montserrat text-sm font-bold text-brand">Pendências</p>
            <p className="text-xs text-gray-500">
              {alertas.length === 0 ? "Nada pendente nos seus módulos." : `${alertas.length} no total${criticos > 0 ? `, ${criticos} crítica${criticos === 1 ? "" : "s"}` : ""}.`}
            </p>
          </div>

          {alertas.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-accent-dark">
              <CheckCircle2 className="h-5 w-5" aria-hidden /> Tudo em dia.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {alertas.map((alerta) => {
                const Icone = alerta.severidade === "critico" ? AlertOctagon : AlertTriangle;
                return (
                  <li key={alerta.id}>
                    <Link href={alerta.href} onClick={() => setAberto(false)} className="flex gap-3 px-4 py-3 hover:bg-gray-50">
                      <Icone className={`mt-0.5 h-5 w-5 shrink-0 ${alerta.severidade === "critico" ? "text-status-error" : "text-secondary-dark"}`} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900">{alerta.titulo}</span>
                        <span className="block text-xs text-gray-600">{alerta.detalhe}</span>
                        <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{LABEL_MODULO[alerta.modulo]}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {central && (
            <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
              {editandoPrazos ? (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    Avisar contas com antecedência de (dias)
                    <input type="number" min={0} max={90} className="input-field w-20 py-1" value={diasContas} onChange={(e) => setDiasContas(e.target.value)} />
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    Avisar documentos com antecedência de (dias)
                    <input type="number" min={0} max={365} className="input-field w-20 py-1" value={diasDocumentos} onChange={(e) => setDiasDocumentos(e.target.value)} />
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => setEditandoPrazos(false)}>
                      Cancelar
                    </button>
                    <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={salvarPrazos} disabled={salvando}>
                      {salvando ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="flex items-center justify-between gap-2">
                  <span>
                    Aviso de contas: {central.config.dias_contas_a_vencer} dias antes · documentos: {central.config.dias_documentos_a_vencer} dias antes
                  </span>
                  {admin && (
                    <button type="button" className="shrink-0 font-semibold text-brand hover:underline" onClick={() => setEditandoPrazos(true)}>
                      Alterar
                    </button>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
