"use client";

import { Carregando } from "@/components/ui/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import { confirmar } from "@/components/ui/confirmar";
import FecharComEsc from "@/components/ui/FecharComEsc";
import { toast } from "@/components/ui/toast";
import { formatarDataHora } from "@/lib/format";
import { DIAS_NA_LIXEIRA, LIXEIRA, diasRestantesNaLixeira, type ItemLixeira, type TipoLixeira } from "@/lib/lixeira";

interface Props {
  tipo: TipoLixeira;
  onFechar: () => void;
  /** Algo foi restaurado — a tela que abriu a lixeira precisa recarregar. */
  onRestaurado: () => void;
}

/** Lixeira (migrações 045 e 047) — só administradores. O que foi excluído
 * fica aqui por 30 dias: pode ser restaurado como estava ou removido de vez.
 * Passado o prazo, a rotina diária remove sozinha. */
export default function Lixeira({ tipo, onFechar, onRestaurado }: Props) {
  const [itens, setItens] = useState<ItemLixeira[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const textos = LIXEIRA[tipo];

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const response = await fetch(`/api/lixeira/${tipo}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErro(payload.error ?? "Não foi possível carregar a lixeira.");
        return;
      }
      setItens(payload.data);
    } catch {
      setErro("Erro de conexão ao carregar a lixeira.");
    }
  }, [tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(item: ItemLixeira, acao: "restaurar" | "excluir") {
    if (acao === "excluir") {
      const seguir = await confirmar(`Excluir "${item.titulo}" definitivamente? ${textos.aoExcluirDeVez} Esta ação não pode ser desfeita pela tela.`, {
        titulo: "Excluir definitivamente",
        confirmarLabel: "Excluir de vez",
      });
      if (!seguir) return;
    }

    setOcupado(item.id);
    try {
      const response = await fetch(`/api/lixeira/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, acao }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.erro(payload.error ?? "Não foi possível concluir a ação.");
        return;
      }
      toast.sucesso(acao === "restaurar" ? `${item.titulo} restaurado.` : `${item.titulo} excluído definitivamente.`);
      if (acao === "restaurar") onRestaurado();
      carregar();
    } catch {
      toast.erro("Erro de conexão. Tente novamente.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="modal-fundo z-50">
      <FecharComEsc onFechar={onFechar} />
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-lixeira" className="modal-caixa sm:max-w-2xl">
        <h2 id="titulo-lixeira" className="mb-1 font-montserrat text-lg font-bold text-brand">
          {textos.titulo}
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          {textos.plural} ficam aqui por {DIAS_NA_LIXEIRA} dias, com tudo preservado. Depois disso são removidos de vez automaticamente.
        </p>

        {erro ? (
          <div className="text-sm text-status-error">
            <p>{erro}</p>
            <button type="button" className="btn-secondary mt-3" onClick={carregar}>
              Tentar de novo
            </button>
          </div>
        ) : !itens ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <p className="text-sm text-gray-400">A lixeira está vazia.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {itens.map((item) => {
              const restam = diasRestantesNaLixeira(item.excluido_em);
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-montserrat text-sm font-bold text-brand">{item.titulo}</p>
                    <p className="text-xs text-gray-500">
                      {item.detalhe && `${item.detalhe} · `}
                      Excluído em {formatarDataHora(item.excluido_em)}
                      {item.excluido_por ? ` por ${item.excluido_por}` : ""}
                    </p>
                    <p className={`text-xs ${restam <= 5 ? "font-semibold text-status-error" : "text-gray-500"}`}>
                      {restam === 0 ? "Será removido de vez na próxima rotina diária." : `Removido de vez em ${restam} dia${restam === 1 ? "" : "s"}.`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" className="btn-accent px-3 py-1.5 text-xs" disabled={ocupado !== null} onClick={() => agir(item, "restaurar")}>
                      Restaurar
                    </button>
                    <button type="button" className="btn-danger px-3 py-1.5 text-xs" disabled={ocupado !== null} onClick={() => agir(item, "excluir")}>
                      Excluir de vez
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="rodape-modal flex justify-end">
          <button type="button" className="btn-secondary" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
