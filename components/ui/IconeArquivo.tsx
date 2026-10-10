import { File, FileImage, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";

const ICONE_POR_TIPO: Record<string, LucideIcon> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  jpg: FileImage,
  jpeg: FileImage,
  png: FileImage,
  gif: FileImage,
  webp: FileImage,
};

interface Props {
  /** Extensão do arquivo ("pdf", "xlsx", "jpg"...), como gravada em `tipo_arquivo`. */
  tipo: string | null | undefined;
  className?: string;
}

/** Ícone de um anexo conforme o tipo do arquivo — usado em todas as listas
 * de anexos (lead, parceiro, fornecedor, funcionário, documentos da empresa). */
export default function IconeArquivo({ tipo, className = "h-5 w-5 shrink-0 text-brand" }: Props) {
  const Icone = (tipo && ICONE_POR_TIPO[tipo.toLowerCase()]) || File;
  return <Icone className={className} aria-hidden />;
}
