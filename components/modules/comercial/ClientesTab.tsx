"use client";

import { Carregando } from "@/components/ui/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import { toast } from "./toast";
import ModalCliente from "./ModalCliente";
import { formatarDataHora } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import type { ClienteResumo } from "@/lib/types/domain";
import { confirmar } from "@/components/ui/confirmar";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import MenuAcoes from "@/components/ui/MenuAcoes";
import Lixeira from "@/components/Lixeira";
import { useAcesso } from "@/lib/hooks/useAcesso";

const POR_PAGINA = 10;

/** Aba "Clientes" do CRM. Paginação client-side (fatiando o array já
 * carregado) — volume esperado pra uma empresa deste porte não justifica
 * paginação no servidor ainda; se a base crescer muito, trocar por
 * `?page=`/`?pageSize=` na query da API é a evolução natural. */
export default function ClientesTab() {
  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const router = useRouter();
  // Editar abre a ficha em página própria; aqui só o cadastro novo.
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ resumo: "1" });
      if (busca) params.set("busca", busca);
      const response = await fetch(`/api/clientes?${params.toString()}`);
      const data = await response.json();
      setClientes(Array.isArray(data) ? data : []);
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPagina(1);
      carregar();
    }, 300);
    return () => clearTimeout(timeout);
  }, [carregar]);

  const [mostrarLixeira, setMostrarLixeira] = useState(false);
  const { acesso } = useAcesso();

  async function excluir(cliente: ClienteResumo) {
    const seguir = await confirmar(
      `Excluir o cliente "${cliente.nome}"? Ele vai para a lixeira; um administrador pode restaurar por 30 dias, depois disso é removido de vez.`,
      { titulo: "Excluir cliente", confirmarLabel: "Enviar para a lixeira" }
    );
    if (!seguir) return;
    const response = await fetch(`/api/clientes/${cliente.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      toast.erro(data.error ?? "Não foi possível excluir o cliente.");
      return;
    }
    toast.sucesso("Cliente enviado para a lixeira.");
    carregar();
  }

  const totalPaginas = Math.max(1, Math.ceil(clientes.length / POR_PAGINA));
  const clientesPagina = clientes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="input-field w-full sm:max-w-xs"
          placeholder="Buscar cliente por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <button type="button" className="btn-primary" onClick={() => setNovo(true)}>
            + Novo cliente
          </button>
          {/* Lixeira (migração 047): clientes excluídos, recuperáveis por 30 dias — só administrador. */}
          <MenuAcoes acoes={acesso?.admin ? [{ label: "Lixeira", onClick: () => setMostrarLixeira(true) }] : []} />
        </div>
        {mostrarLixeira && <Lixeira tipo="clientes" onFechar={() => setMostrarLixeira(false)} onRestaurado={carregar} />}
      </div>

      {carregando ? (
        <Carregando linhas={6} />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="tabela-cartoes w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Cidade</th>
                <th className="px-4 py-2 text-left">Última interação</th>
                <th className="px-4 py-2 text-left">Leads</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientesPagina.map((cliente) => (
                <tr key={cliente.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/comercial/clientes/${cliente.id}`)}>
                  <td data-label="Nome" className="px-4 py-2 font-medium text-brand">{cliente.nome}</td>
                  <td data-label="Telefone" className="px-4 py-2 text-gray-500">{cliente.telefone ?? "—"}</td>
                  <td data-label="Email" className="so-computador px-4 py-2 text-gray-500">{cliente.email ?? "—"}</td>
                  <td data-label="Cidade" className="px-4 py-2 text-gray-500">{cliente.cidade ?? "—"}</td>
                  <td data-label="Última interação" className="so-computador px-4 py-2 text-gray-500">
                    {cliente.ultima_interacao ? formatarDataHora(cliente.ultima_interacao) : "—"}
                  </td>
                  <td data-label="Leads" className="px-4 py-2 text-gray-500">{cliente.total_leads}</td>
                  <td data-label="Ações" className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <MenuAcoes discreto
                      alinhar="direita"
                      acoes={[
                        { label: "Abrir ficha", href: `/comercial/clientes/${cliente.id}` },
                        { label: "Excluir", icone: <Trash2 className="icone" aria-hidden />, perigo: true, onClick: () => excluir(cliente) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {clientesPagina.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="text-xs text-gray-500">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima →
          </button>
        </div>
      )}

      {novo && (
        <ModalCliente
          cliente={null}
          onFechar={() => setNovo(false)}
          onSalvo={() => {
            setNovo(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
