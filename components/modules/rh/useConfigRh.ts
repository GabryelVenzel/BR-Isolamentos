"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentoObrigatorioEmpresa, TipoDocumentoRh } from "@/lib/rh";

export interface ConfigRh {
  tiposDocumento: TipoDocumentoRh[];
  obrigatorios: DocumentoObrigatorioEmpresa[];
  /** Antecedência do aviso "vence em N dias" (a mesma dos alertas). */
  diasAviso: number;
}

/** Listas do RH (migração 052) — tipos de documento de funcionário e
 * documentos obrigatórios da empresa, editáveis em RH → Configurações. */
export function useConfigRh(): { config: ConfigRh | null; recarregar: () => void } {
  const [config, setConfig] = useState<ConfigRh | null>(null);

  const recarregar = useCallback(() => {
    fetch("/api/rh/config")
      .then((r) => r.json())
      .then((p) => setConfig(p?.success ? p.data : { tiposDocumento: [], obrigatorios: [], diasAviso: 30 }))
      .catch(() => setConfig({ tiposDocumento: [], obrigatorios: [], diasAviso: 30 }));
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { config, recarregar };
}
