import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Conteudo from "@/components/Conteudo";
import ConfirmarHost from "@/components/ui/confirmar";
import ToastContainer from "@/components/ui/ToastContainer";
import "./globals.css";

// Fonte de título/UI do Brand Book — self-hosted pelo next/font (sem
// request extra a fonts.googleapis.com em runtime, sem layout shift).
// Exposta como CSS var e referenciada em tailwind.config.ts (font-montserrat).
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BR Isolamentos | Gestão",
  description: "Sistema de gestão da BR Isolamentos — orçamentos, comercial, operação, financeiro e RH.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body className="flex min-h-screen flex-col">
        <Navbar />
        <Conteudo>{children}</Conteudo>
        <Footer />
        <ToastContainer />
        <ConfirmarHost />
      </body>
    </html>
  );
}
