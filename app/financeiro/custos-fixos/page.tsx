"use client";
import CabecalhoPagina from "@/components/ui/CabecalhoPagina";
import { Carregando } from "@/components/ui/Esqueleto";

import { useCallback, useEffect, useState } from "react";
import ModalCustoFixo from "@/components/modules/financeiro/ModalCustoFixo";
import CustoFixoCard from "@/components/modules/financeiro/CustoFixoCard";
import { formatarMoeda } from "@/lib/format";
import type { CustoFixo } from "@/lib/types/domain";

export default function CustosFixosPage() {
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<CustoFixo | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch("/api/financeiro/custos-fixos");
      const payload = await response.json();
      if (payload.success) setCustos(payload.data);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalAtivo = custos.filter((c) => c.ativo).reduce((acc, c) => acc + c.valor_mensal, 0);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Custos Fixos"
        descricao={
          <>
            Total mensal dos custos ativos: <span className="font-bold text-brand">{formatarMoeda(totalAtivo)}</span>
          </>
        }
        acaoPrincipal={{ label: "+ Novo Custo Fixo", onClick: () => setEditando("novo") }}
      />

      {carregando ? (
        <Carregando />
      ) : custos.length === 0 ? (
        <div className="card text-center text-sm text-gray-500">Nenhum custo fixo cadastrado ainda.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {custos.map((custo) => (
            <CustoFixoCard key={custo.id} custoFixo={custo} onEditar={() => setEditando(custo)} onMudou={carregar} />
          ))}
        </div>
      )}

      {editando && (
        <ModalCustoFixo
          custoFixo={editando === "novo" ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
