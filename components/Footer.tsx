/** Rodapé fixo do app (não das propostas em PDF — ver PdfFooter em
 * components/pdf/). Sempre visível no fim da página, conforme o Brand Book:
 * fundo azul marinho, texto branco centralizado. */
export default function Footer() {
  return (
    // Discreto (revisão de usabilidade): antes ocupava uma faixa alta em toda tela.
    <footer className="mt-auto border-t border-gray-200 py-3 text-center text-xs text-gray-400">
      <p>
        © {new Date().getFullYear()} BR Isolamentos. Soluções em Isolamentos Térmicos.
      </p>
    </footer>
  );
}
