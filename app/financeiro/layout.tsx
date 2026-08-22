import ModuleSubNav from "@/components/ModuleSubNav";
import { FINANCEIRO_SUBNAV } from "@/lib/module-nav";

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ModuleSubNav items={FINANCEIRO_SUBNAV} />
      {children}
    </div>
  );
}
