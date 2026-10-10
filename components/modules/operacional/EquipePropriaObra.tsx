"use client";

import { useEffect, useState } from "react";
import { HardHat, Trash2 } from "lucide-react";
import { confirmar } from "@/components/ui/confirmar";
import FecharComEsc from "@/components/ui/FecharComEsc";
import type { DocumentoVencidoDeFuncionario, FuncionarioParaObra } from "@/lib/contexts/compras";
import { formatarData } from "@/lib/format";
import type { ServicoFuncionarioExecucao, TipoTrabalhoOperacional } from "@/lib/types/domain";
import MultiSelectTiposTrabalho, { TIPOS_TRABALHO_OPCOES } from "./MultiSelectTiposTrabalho";
import { toast } from "./toast";

const LABEL_TIPO: Record<string, string> = Object.fromEntries(TIPOS_TRABALHO_OPCOES.map((o) => [o.valor, o.label]));

interface Props {
  servicoId: string;
  execucoes: ServicoFuncionarioExecucao[];
  /** Recarrega o serviço depois de alocar ou remover alguém. */
  onMudou: () => void;
}

/** Seção "Equipe própria" do detalhe de um serviço: funcionários alocados na
 * obra e as funções que exercem nela — o equivalente, para funcionários, da
 * seção de Parceiros (migração 044). Cada funcionário alocado conta como
 * uma pessoa mobilizada na Agenda. */
export default function EquipePropriaObra({ servicoId, execucoes, onMudou }: Props) {
  const [adicionando, setAdicionando] = useState(false);

  async function remover(execucao: ServicoFuncionarioExecucao) {
    if (!(await confirmar(`Remover ${execucao.funcionario?.nome ?? "este funcionário"} da obra?`))) return;
    const response = await fetch(`/api/operacional/servicos/${servicoId}/funcionarios?execucao=${execucao.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      toast.erro(payload.error ?? "Não foi possível remover o funcionário.");
      return;
    }
    toast.sucesso("Funcionário removido da obra.");
    onMudou();
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-montserrat text-xs font-bold uppercase text-brand">
          <HardHat className="icone" aria-hidden /> Equipe própria
        </h3>
        <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => setAdicionando(true)}>
          + Adicionar Funcionário
        </button>
      </div>

      <div className="space-y-2">
        {execucoes.map((execucao) => (
          <div key={execucao.id} className="rounded-card border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">
                  {execucao.funcionario?.nome ?? "—"}
                  {execucao.funcionario?.cargo && <span className="font-normal text-gray-400"> ({execucao.funcionario.cargo})</span>}
                </p>
                <p className="text-xs text-gray-500">{execucao.tipos_trabalho.map((t) => LABEL_TIPO[t] ?? t).join(", ") || "Função não informada"}</p>
              </div>
              <button type="button" title="Remover da obra" aria-label="Remover da obra" className="shrink-0 hover:opacity-70" onClick={() => remover(execucao)}>
                <Trash2 className="icone" aria-hidden />
              </button>
            </div>
          </div>
        ))}
        {execucoes.length === 0 && <p className="text-sm text-gray-400">Nenhum funcionário alocado ainda.</p>}
      </div>

      {adicionando && (
        <ModalAdicionarFuncionario
          servicoId={servicoId}
          jaAlocados={execucoes.map((e) => e.funcionario_id)}
          onFechar={() => setAdicionando(false)}
          onAdicionado={() => {
            setAdicionando(false);
            onMudou();
          }}
        />
      )}
    </div>
  );
}

function ModalAdicionarFuncionario({
  servicoId,
  jaAlocados,
  onFechar,
  onAdicionado,
}: {
  servicoId: string;
  jaAlocados: string[];
  onFechar: () => void;
  onAdicionado: () => void;
}) {
  const [funcionarios, setFuncionarios] = useState<FuncionarioParaObra[]>([]);
  const [vencidos, setVencidos] = useState<DocumentoVencidoDeFuncionario[]>([]);
  const [funcionarioId, setFuncionarioId] = useState("");
  const [tipos, setTipos] = useState<TipoTrabalhoOperacional[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/operacional/funcionarios")
      .then((r) => r.json())
      .then((p) => {
        if (!p.success) return;
        setFuncionarios(p.data.funcionarios);
        setVencidos(p.data.documentosVencidos);
      })
      .catch(() => undefined);
  }, []);

  const disponiveis = funcionarios.filter((f) => !jaAlocados.includes(f.id));
  const vencidosDoFuncionario = vencidos.filter((d) => d.funcionarioId === funcionarioId);

  // Ao escolher a pessoa, as funções já vêm marcadas com as do cadastro dela.
  function escolher(id: string) {
    setFuncionarioId(id);
    setTipos((funcionarios.find((f) => f.id === id)?.tipos_trabalho ?? []) as TipoTrabalhoOperacional[]);
  }

  async function adicionar() {
    if (!funcionarioId) return setErro("Selecione o funcionário.");
    if (tipos.length === 0) return setErro("Selecione pelo menos uma função.");
    setErro(null);

    // Documentação vencida: avisa e pede confirmação, como para parceiros.
    if (vencidosDoFuncionario.length > 0) {
      const seguir = await confirmar(
        `Este funcionário tem ${vencidosDoFuncionario.length === 1 ? "documento vencido" : "documentos vencidos"}: ${vencidosDoFuncionario
          .map((d) => `${d.nome} (${formatarData(d.validade)})`)
          .join(", ")}. Alocar na obra mesmo assim?`,
        { titulo: "Documentação vencida", confirmarLabel: "Alocar mesmo assim", perigo: false }
      );
      if (!seguir) return;
    }

    setSalvando(true);
    try {
      const response = await fetch(`/api/operacional/servicos/${servicoId}/funcionarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionario_id: funcionarioId, tipos_trabalho: tipos }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível alocar o funcionário.");
        return;
      }
      toast.sucesso("Funcionário alocado na obra.");
      onAdicionado();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand/60 p-4">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-add-funcionario" className="w-full max-w-md rounded-card bg-white p-6 shadow-card-hover">
        <h2 id="titulo-add-funcionario" className="mb-4 font-montserrat text-lg font-bold text-brand">
          Adicionar Funcionário à Obra
        </h2>

        <div className="space-y-4">
          <div>
            <label className="label-field" htmlFor="add-funcionario">
              Funcionário<span className="text-status-error"> *</span>
            </label>
            <select id="add-funcionario" className="input-field" value={funcionarioId} onChange={(e) => escolher(e.target.value)}>
              <option value="">Selecione...</option>
              {disponiveis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                  {f.cargo ? ` — ${f.cargo}` : ""}
                </option>
              ))}
            </select>
            {funcionarios.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">Nenhum funcionário ativo cadastrado. O cadastro fica em RH → Funcionários.</p>
            )}
            {vencidosDoFuncionario.length > 0 && (
              <p role="alert" className="mt-2 rounded-input bg-red-50 px-3 py-2 text-xs text-status-error">
                Documentação vencida: {vencidosDoFuncionario.map((d) => `${d.nome} (${formatarData(d.validade)})`).join(", ")}.
              </p>
            )}
          </div>

          <div>
            <p className="label-field">
              Funções nesta obra<span className="text-status-error"> *</span>
            </p>
            <MultiSelectTiposTrabalho value={tipos} onChange={setTipos} options={TIPOS_TRABALHO_OPCOES} />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-status-error">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={adicionar} disabled={salvando}>
              {salvando ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
