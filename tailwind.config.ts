import type { Config } from "tailwindcss";

// Tokens de identidade visual — ver "1-IdentidadeVisual/Brand Book - BR
// ISOLAMENTOS.pdf" para a referência oficial. `brand` (azul marinho) e
// `accent` (verde) já eram os nomes usados em todo o app antes desta marca
// ter cores 100% definidas — mantidos para não precisar tocar em cada uma
// das ~280 ocorrências de `text-brand`/`bg-accent`/etc. espalhadas pelas
// páginas; só os valores HEX foram atualizados para bater com o Brand Book.
// `secondary` (amarelo) é novo. `status.*` são aliases semânticos dos mesmos
// tons, para usar em alertas/badges sem precisar "traduzir" cor→significado.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#060035", // azul marinho — primária
          dark: "#03001d", // hover de botões/links primários
          light: "#eceaf4", // tint claro p/ backgrounds e boxes de destaque
        },
        secondary: {
          DEFAULT: "#FBC819", // amarelo — energia/destaque
          dark: "#d9ab00",
          light: "#fef6db",
        },
        accent: {
          DEFAULT: "#078B41", // verde — solução/sucesso
          dark: "#056030",
          light: "#e5f4ea",
        },
        status: {
          success: "#078B41",
          error: "#DC3545",
          warning: "#FBC819",
          info: "#060035",
        },
      },
      fontFamily: {
        // Montserrat: títulos, labels, botões, navegação (ver globals.css
        // para o @import do Google Fonts).
        montserrat: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
        // "Alfaim 2" (fonte de corpo do Brand Book) não está disponível no
        // Google Fonts nem embarcada no projeto — fallback documentado para
        // uma stack sans-serif do sistema até a fonte oficial ser fornecida.
        alfaim: [
          "Alfaim 2",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "8px",
        input: "4px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(6, 0, 53, 0.1)",
        "card-hover": "0 8px 16px rgba(6, 0, 53, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
