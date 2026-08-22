import Logo from "@/components/Logo";
import { formatarData } from "@/lib/format";

interface Props {
  titulo: string;
  numero: string;
  data: string;
  tipoTrabalho: string;
}

/** Cabeçalho comum às duas propostas (comercial/técnica): logo + título à
 * esquerda, número/data à direita, linha verde da marca por baixo. */
export default function PdfHeader({ titulo, numero, data, tipoTrabalho }: Props) {
  return (
    <header className="mb-6">
      <div className="flex items-start justify-between">
        <div>
          <Logo variant="navy" height={36} />
          <h1 className="mt-3 font-montserrat text-xl font-bold text-brand">{titulo}</h1>
        </div>
        <div className="text-right font-alfaim text-xs text-gray-500">
          <p className="font-montserrat text-sm font-semibold text-brand">Nº {numero}</p>
          <p className="mt-1">{formatarData(data)}</p>
          <p>{tipoTrabalho}</p>
        </div>
      </div>
      <div className="divider-brand" />
    </header>
  );
}
