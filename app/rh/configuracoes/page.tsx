"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "@/components/modules/rh/toast";
import { useConfigRh } from "@/components/modules/rh/useConfigRh";
import { CATEGORIAS_DOCUMENTO_EMPRESA, LABEL_CATEGORIA_DOCUMENTO, type DocumentoObrigatorioEmpresa, type TipoDocumentoRh } from "@/lib/rh";

/** RH → Configurações (migração 052): as duas listas que padronizam a
 * documentação — tipos de documento de funcionário (com a validade padrão,
 * que calcula o vencimento a partir da emissão) e documentos que a empresa
 * precisa ter em dia (o checklist da aba Empresa). O `id` de cada item não
 * muda ao renomear: é por ele que os documentos já anexados continuam ligados. */
export default function ConfiguracoesRhPage() {
  const { config } = useConfigRh();
  const [tipos, setTipos] = useState<TipoDocumentoRh[]>([]);
  const [obrigatorios, setObrigatorios] = useState<DocumentoObrigatorioEmpresa[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!config) return;
    setTipos(config.tiposDocumento);
    setObrigatorios(config.obrigatorios);
  }, [config]);

  async function salvar() {
    if ([...tipos, ...obrigatorios].some((i) => !i.nome.trim())) return toast.erro("Todo item precisa de nome — preencha ou remova as linhas vazias.");
    setSalvando(true);
    try {
      const r = await fetch("/api/rh/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rh_tipos_documento: tipos, rh_documentos_obrigatorios: obrigatorios }),
      }).then((x) => x.json());
      if (!r.success) return toast.erro(r.error ?? "Não foi possível salvar.");
      toast.sucesso("Configurações do RH salvas.");
    } finally {
      setSalvando(false);
    }
  }

  const meses = (v: string) => (v === "" ? null : Math.max(1, Math.round(Number(v)) || 1));
  const novoId = () => `item_${Date.now()}`;

  if (!config) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações do RH</h1>
        <p className="text-sm text-gray-500">Listas que padronizam a documentação. Validade em meses; em branco = não vence.</p>
      </div>

      <section className="card space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Tipos de documento de funcionário</h2>
          <p className="text-xs text-gray-500">
            Ao anexar um documento na ficha, escolha o tipo e a data de emissão: a validade é calculada com o prazo daqui. Quando um documento
            é renovado (novo ASO, nova NR-35), o anterior do mesmo tipo deixa de contar como pendência.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="table-header">
            <tr>
              <th className="px-2 py-2 text-left">Tipo</th>
              <th className="w-40 px-2 py-2 text-left">Validade (meses)</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tipos.map((t, i) => (
              <tr key={t.id}>
                <td className="px-2 py-1.5">
                  <input className="input-field" aria-label="Nome do tipo" value={t.nome} onChange={(e) => setTipos((l) => l.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    aria-label="Validade em meses"
                    placeholder="Não vence"
                    value={t.validade_meses ?? ""}
                    onChange={(e) => setTipos((l) => l.map((x, j) => (j === i ? { ...x, validade_meses: meses(e.target.value) } : x)))}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button type="button" className="hover:opacity-70" title="Remover" aria-label="Remover" onClick={() => setTipos((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 className="icone" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn-secondary" onClick={() => setTipos((l) => [...l, { id: novoId(), nome: "", validade_meses: 12 }])}>
          + Adicionar tipo
        </button>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Documentos obrigatórios da empresa</h2>
          <p className="text-xs text-gray-500">
            Viram o checklist da aba Empresa: o que falta enviar, o que está em dia e o que venceu. Certidões vencem rápido (a do FGTS, em
            cerca de 30 dias) — o sistema avisa antes, junto com os demais alertas.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="table-header">
            <tr>
              <th className="px-2 py-2 text-left">Documento</th>
              <th className="w-56 px-2 py-2 text-left">Categoria</th>
              <th className="w-40 px-2 py-2 text-left">Validade (meses)</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {obrigatorios.map((d, i) => (
              <tr key={d.id}>
                <td className="px-2 py-1.5">
                  <input className="input-field" aria-label="Nome do documento" value={d.nome} onChange={(e) => setObrigatorios((l) => l.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    className="input-field"
                    aria-label="Categoria"
                    value={d.categoria}
                    onChange={(e) => setObrigatorios((l) => l.map((x, j) => (j === i ? { ...x, categoria: e.target.value as DocumentoObrigatorioEmpresa["categoria"] } : x)))}
                  >
                    {CATEGORIAS_DOCUMENTO_EMPRESA.map((c) => (
                      <option key={c} value={c}>
                        {LABEL_CATEGORIA_DOCUMENTO[c]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={1}
                    className="input-field"
                    aria-label="Validade em meses"
                    placeholder="Não vence"
                    value={d.validade_meses ?? ""}
                    onChange={(e) => setObrigatorios((l) => l.map((x, j) => (j === i ? { ...x, validade_meses: meses(e.target.value) } : x)))}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button type="button" className="hover:opacity-70" title="Remover" aria-label="Remover" onClick={() => setObrigatorios((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 className="icone" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setObrigatorios((l) => [...l, { id: novoId(), nome: "", categoria: "outros", validade_meses: null }])}
        >
          + Adicionar documento
        </button>
      </section>

      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
