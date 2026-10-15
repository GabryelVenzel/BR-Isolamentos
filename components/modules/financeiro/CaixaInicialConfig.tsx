"use client";

import { useEffect, useState } from "react";
import { CampoMoeda } from "@/components/ui/CamposDocumento";
import { toast } from "./toast";

/** Ponto de partida do fluxo de caixa (migração 053): em que data e com
 * quanto em conta o caixa começou. O Resumo soma, a partir daí, tudo que foi
 * pago e recebido para chegar ao "Caixa hoje". */
export default function CaixaInicialConfig() {
  const [data, setData] = useState("");
  const [saldo, setSaldo] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/financeiro/caixa")
      .then((r) => r.json())
      .then((p) => {
        if (p.success && p.data) {
          setData(p.data.caixa_data_inicial ?? "2026-09-28");
          setSaldo(String(p.data.caixa_saldo_inicial ?? 0));
        } else {
          setData("2026-09-28");
          setSaldo("0");
        }
      })
      .finally(() => setCarregado(true));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch("/api/financeiro/caixa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caixa_data_inicial: data, caixa_saldo_inicial: Number(saldo) || 0 }),
      }).then((x) => x.json());
      if (!r.success) return toast.erro(r.error ?? "Não foi possível salvar.");
      toast.sucesso("Ponto de partida do caixa salvo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card max-w-md space-y-4">
      <div>
        <h3 className="font-montserrat text-sm font-bold uppercase text-brand">Início do caixa</h3>
        <p className="mt-1 text-xs text-gray-500">
          Data e saldo em conta de onde o fluxo de caixa parte. O &quot;Caixa hoje&quot; do Resumo é esse saldo mais tudo que foi recebido e pago desde
          então. Se o caixa não bater com o banco, ajuste aqui.
        </p>
      </div>
      {carregado && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="caixa-data">
              Data inicial
            </label>
            <input id="caixa-data" type="date" className="input-field" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className="label-field" htmlFor="caixa-saldo">
              Saldo nessa data
            </label>
            <CampoMoeda id="caixa-saldo" value={saldo} onChange={setSaldo} />
          </div>
        </div>
      )}
      <button type="button" className="btn-primary" onClick={salvar} disabled={salvando || !carregado}>
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
