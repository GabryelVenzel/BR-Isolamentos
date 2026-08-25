"use client";

export interface TabItem<T extends string> {
  valor: T;
  label: string;
}

interface Props<T extends string> {
  tabs: Array<TabItem<T>>;
  activeTab: T;
  onTabChange: (valor: T) => void;
}

/** Classes de estilo compartilhadas entre esta navegação (por estado local —
 * Resumo, Comercial) e `ModuleSubNav` (por rota — Operacional, Financeiro,
 * Orçamento): retangular (`rounded-t-lg`, não pílula/`rounded-full`), borda
 * de destaque, fundo transparente/muito leve (nunca semitransparente forte),
 * Montserrat Bold, transição suave. Um único lugar pra essas classes evita
 * as duas implementações divergirem de novo no futuro. */
export const CLASSES_ABA_ATIVA = "border-b-2 border-brand bg-brand-light text-brand";
export const CLASSES_ABA_INATIVA = "text-gray-500 hover:bg-gray-50";
export const CLASSES_ABA_BASE = "rounded-t-lg px-4 py-2 font-montserrat text-sm font-semibold transition-colors";

/** Navegação por sub-abas dentro de um módulo, quando a aba é estado local
 * (não muda a URL) — ex.: Resumo (Geral/Operação/Comercial/Financeira),
 * Comercial (CRM/Clientes/Configurações). Para sub-navegação por ROTA (cada
 * aba é uma página própria), usar `ModuleSubNav` — mesmo visual, semântica
 * de navegação diferente. */
export default function TabsNavigation<T extends string>({ tabs, activeTab, onTabChange }: Props<T>) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.valor}
          type="button"
          onClick={() => onTabChange(tab.valor)}
          className={`${CLASSES_ABA_BASE} ${activeTab === tab.valor ? CLASSES_ABA_ATIVA : CLASSES_ABA_INATIVA}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
