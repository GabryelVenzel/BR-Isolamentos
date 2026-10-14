// Regras do módulo RH (migração 052) — puro, sem I/O: tipos de documento com
// validade padrão, situação da documentação, documentos obrigatórios da
// empresa, vínculos, ausências e EPI. Usado pelas telas, pelos alertas e pela
// capacidade.

import { situacaoValidade } from "./alertas";

// --------------------------------------------------------------------------
// Listas configuráveis (RH → Configurações)
// --------------------------------------------------------------------------

/** Tipo de documento de funcionário (ASO, NR-35...) e a validade padrão. */
export interface TipoDocumentoRh {
  id: string;
  nome: string;
  /** `null` = não vence. */
  validade_meses: number | null;
}

export const CATEGORIAS_DOCUMENTO_EMPRESA = ["juridico", "fiscal", "sst", "contratos", "outros"] as const;
export type CategoriaDocumentoEmpresa = (typeof CATEGORIAS_DOCUMENTO_EMPRESA)[number];

export const LABEL_CATEGORIA_DOCUMENTO: Record<CategoriaDocumentoEmpresa, string> = {
  juridico: "Jurídico",
  fiscal: "Fiscal e certidões",
  sst: "Segurança do Trabalho (SST)",
  contratos: "Contratos e seguros",
  outros: "Outros",
};

/** Documento que a empresa precisa ter em dia. */
export interface DocumentoObrigatorioEmpresa {
  id: string;
  nome: string;
  categoria: CategoriaDocumentoEmpresa;
  validade_meses: number | null;
}

/** Normaliza a lista guardada em `config_empresa` (formato livre, jsonb). */
export function listaTiposDocumento(bruto: unknown): TipoDocumentoRh[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((t) => t && typeof t.id === "string" && typeof t.nome === "string" && t.nome.trim() !== "")
    .map((t) => ({ id: t.id, nome: t.nome.trim(), validade_meses: mesesValidos(t.validade_meses) }));
}

export function listaDocumentosObrigatorios(bruto: unknown): DocumentoObrigatorioEmpresa[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((d) => d && typeof d.id === "string" && typeof d.nome === "string" && d.nome.trim() !== "")
    .map((d) => ({
      id: d.id,
      nome: d.nome.trim(),
      categoria: (CATEGORIAS_DOCUMENTO_EMPRESA as readonly string[]).includes(d.categoria) ? d.categoria : "outros",
      validade_meses: mesesValidos(d.validade_meses),
    }));
}

function mesesValidos(v: unknown): number | null {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) || n <= 0 ? null : Math.round(n);
}

// --------------------------------------------------------------------------
// Validade
// --------------------------------------------------------------------------

/** Emissão + N meses (YYYY-MM-DD). Dia que não existe no mês de destino cai
 * no último dia desse mês (31/01 + 1 mês = 28 ou 29/02). */
export function somarMeses(dataIso: string, meses: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/** Validade sugerida para um documento do tipo, emitido na data informada. */
export function validadePadrao(tipo: Pick<TipoDocumentoRh, "validade_meses"> | null | undefined, dataEmissao: string | null | undefined): string | null {
  if (!tipo?.validade_meses || !dataEmissao) return null;
  return somarMeses(dataEmissao, tipo.validade_meses);
}

// --------------------------------------------------------------------------
// Situação da documentação
// --------------------------------------------------------------------------

interface DocumentoComTipo {
  id?: string;
  tipo_id?: string | null;
  validade: string | null;
}

/** Os documentos que VALEM hoje: de cada tipo, só o de validade mais longa
 * (sem validade = não vence, vale sempre) — um ASO renovado não deixa o ASO
 * antigo, vencido, contando como pendência. Documento sem tipo conta
 * sozinho, como antes. */
export function documentosVigentes<T extends DocumentoComTipo>(documentos: T[]): T[] {
  const semTipo = documentos.filter((d) => !d.tipo_id);
  const porTipo = new Map<string, T>();
  for (const doc of documentos) {
    if (!doc.tipo_id) continue;
    const atual = porTipo.get(doc.tipo_id);
    if (!atual || venceDepois(doc.validade, atual.validade)) porTipo.set(doc.tipo_id, doc);
  }
  return [...semTipo, ...porTipo.values()];
}

/** `a` vale por mais tempo que `b`? (sem validade = para sempre) */
function venceDepois(a: string | null, b: string | null): boolean {
  if (a === null) return b !== null;
  if (b === null) return false;
  return a > b;
}

export type SituacaoDocumentacao = "em_dia" | "vencendo" | "vencido" | "sem_documentos";

export const LABEL_SITUACAO_DOCUMENTACAO: Record<SituacaoDocumentacao, string> = {
  em_dia: "Documentação em dia",
  vencendo: "Documento vencendo",
  vencido: "Documento vencido",
  sem_documentos: "Sem documentos",
};

/** A pior situação entre os documentos vigentes de um funcionário. */
export function situacaoDocumentacao(documentos: DocumentoComTipo[], hoje: string, diasAviso: number): { situacao: SituacaoDocumentacao; vencidos: number; vencendo: number } {
  if (documentos.length === 0) return { situacao: "sem_documentos", vencidos: 0, vencendo: 0 };
  let vencidos = 0;
  let vencendo = 0;
  for (const doc of documentosVigentes(documentos)) {
    if (!doc.validade) continue;
    const s = situacaoValidade(doc.validade, hoje, diasAviso);
    if (s === "vencido") vencidos++;
    else if (s === "vencendo") vencendo++;
  }
  return { situacao: vencidos > 0 ? "vencido" : vencendo > 0 ? "vencendo" : "em_dia", vencidos, vencendo };
}

/** Checklist dos documentos obrigatórios da empresa: para cada item da
 * lista, o documento atual que o cumpre (pelo `tipo_id`) e a situação. */
export type SituacaoObrigatorio = "em_dia" | "vencendo" | "vencido" | "faltando";

export function checklistObrigatorios<D extends { tipo_id?: string | null; validade: string | null }>(
  obrigatorios: DocumentoObrigatorioEmpresa[],
  documentos: D[],
  hoje: string,
  diasAviso: number
): Array<{ obrigatorio: DocumentoObrigatorioEmpresa; documento: D | null; situacao: SituacaoObrigatorio }> {
  return obrigatorios.map((obrigatorio) => {
    const candidatos = documentos.filter((d) => d.tipo_id === obrigatorio.id);
    const documento = documentosVigentes(candidatos.map((d) => ({ ...d, tipo_id: obrigatorio.id })))[0] ?? null;
    if (!documento) return { obrigatorio, documento: null, situacao: "faltando" as const };
    const original = candidatos.find((d) => d.validade === documento.validade) ?? null;
    const s = documento.validade ? situacaoValidade(documento.validade, hoje, diasAviso) : "em_dia";
    return { obrigatorio, documento: original, situacao: s === "vencido" ? "vencido" : s === "vencendo" ? "vencendo" : "em_dia" };
  });
}

// --------------------------------------------------------------------------
// Vínculo, ausências e EPI
// --------------------------------------------------------------------------

export const VINCULOS = ["clt", "pj", "socio", "diarista", "outro"] as const;
export type VinculoFuncionario = (typeof VINCULOS)[number];

export const LABEL_VINCULO: Record<VinculoFuncionario, string> = {
  clt: "CLT",
  pj: "PJ",
  socio: "Sócio (pró-labore)",
  diarista: "Diarista",
  outro: "Outro",
};

export const TIPOS_AUSENCIA = ["ferias", "atestado", "afastamento", "folga", "outro"] as const;
export type TipoAusencia = (typeof TIPOS_AUSENCIA)[number];

export const LABEL_AUSENCIA: Record<TipoAusencia, string> = {
  ferias: "Férias",
  atestado: "Atestado",
  afastamento: "Afastamento",
  folga: "Folga",
  outro: "Outro",
};

interface PeriodoAusencia {
  funcionario_id: string;
  inicio: string;
  fim: string;
}

/** O funcionário está ausente nesse dia? */
export function ausenteNoDia(ausencias: PeriodoAusencia[], funcionarioId: string, data: string): boolean {
  return ausencias.some((a) => a.funcionario_id === funcionarioId && a.inicio <= data && a.fim >= data);
}

/** Ausências que cruzam o período [inicio, fim] (fim aberto = até sempre). */
export function ausenciasNoPeriodo<A extends PeriodoAusencia>(ausencias: A[], funcionarioId: string, inicio: string, fim: string | null): A[] {
  return ausencias.filter((a) => a.funcionario_id === funcionarioId && a.fim >= inicio && (fim === null || a.inicio <= fim));
}

/** Dias corridos de uma ausência, contando o primeiro e o último. */
export function diasDeAusencia(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Sugestão de itens de EPI — só para autocompletar na entrega. */
export const EPIS_SUGERIDOS = [
  "Capacete com jugular",
  "Óculos de segurança",
  "Protetor auricular",
  "Luva de vaqueta",
  "Luva anticorte",
  "Botina de segurança",
  "Uniforme (camisa)",
  "Uniforme (calça)",
  "Cinto de segurança tipo paraquedista",
  "Talabarte duplo",
  "Máscara PFF2",
  "Creme de proteção",
];
