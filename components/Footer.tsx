/** Rodapé fixo do app (não das propostas em PDF — ver PdfFooter em
 * components/pdf/). Sempre visível no fim da página, conforme o Brand Book:
 * fundo azul marinho, texto branco centralizado. */
export default function Footer() {
  return (
    <footer className="mt-auto bg-brand py-5 text-center text-xs text-white/80">
      <p>
        © {new Date().getFullYear()} BR Isolamentos. Soluções em Isolamentos Térmicos.
      </p>
    </footer>
  );
}
