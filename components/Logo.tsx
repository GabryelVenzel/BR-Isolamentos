interface Props {
  /** "white" = letras BR brancas (usar sobre fundo azul marinho — navbar, footer).
   *  "navy" = letras BR azul marinho (usar sobre fundo branco/claro — cabeçalho do PDF). */
  variant?: "white" | "navy";
  /** Altura em px — a largura acompanha proporcionalmente (marca é ~2.9:1). */
  height?: number;
  className?: string;
}

const SRC = {
  white: "/brand/logo-mark-white.svg",
  navy: "/brand/logo-mark-navy.svg",
};

/** Marca "BR + hexágono" (sem o wordmark "ISOLAMENTOS" nem o slogan — ver
 * public/brand/ e o comentário nos próprios SVGs). Usada na Navbar, no rodapé
 * e no cabeçalho das propostas em PDF, sempre nas proporções originais.
 *
 * SVG estático servido direto de `public/` via `<img>` — sem `next/image`
 * (o otimizador da Vercel não processa SVG por padrão e não traria ganho
 * nenhum aqui: é vetor, já é leve e nítido em qualquer tamanho). */
export default function Logo({ variant = "white", height = 40, className }: Props) {
  const width = Math.round(height * (706 / 240));
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={SRC[variant]}
      alt="BR Isolamentos"
      width={width}
      height={height}
      className={className}
    />
  );
}
