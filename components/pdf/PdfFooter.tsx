interface Props {
  observacao: string;
  /** Telefone/e-mail vêm de `config_empresa` (cadastro real da empresa, ver
   * app/config-precos) — nunca hardcoded aqui. Quando ainda não configurados,
   * a linha de contato simplesmente não aparece em vez de mostrar um dado
   * inventado. */
  telefoneEmpresa?: string | null;
  emailEmpresa?: string | null;
}

/** Rodapé comum às duas propostas: linha verde da marca, slogan, contato e
 * conformidade normativa. Sem numeração "Página X de Y" — o PDF é gerado por
 * captura de tela (html2canvas) fatiada por altura em lib/pdf-generator.ts, e
 * essa fatia não conhece os limites reais de conteúdo por página, então um
 * contador aqui seria só um número inventado. */
export default function PdfFooter({ observacao, telefoneEmpresa, emailEmpresa }: Props) {
  const contato = [telefoneEmpresa, emailEmpresa].filter(Boolean).join("  ·  ");

  return (
    <footer className="mt-10 break-inside-avoid">
      <div className="divider-brand" />
      <p className="font-montserrat text-[10px] font-bold uppercase tracking-wide text-accent">
        BR Isolamentos — Soluções em Isolamentos Térmicos
      </p>
      {contato && <p className="mt-1 font-alfaim text-[10px] text-gray-500">{contato}</p>}
      <p className="mt-2 font-alfaim text-[9px] text-gray-400">
        {observacao} Orçamento válido por 30 dias. Cálculos conforme normas ASTM C680, ISO 12241 e
        ABNT NBR 16281.
      </p>
    </footer>
  );
}
