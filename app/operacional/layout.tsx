import ModuleSubNav from "@/components/ModuleSubNav";
import { OPERACIONAL_SUBNAV } from "@/lib/module-nav";

export default function OperacionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ModuleSubNav items={OPERACIONAL_SUBNAV} />
      {children}
    </div>
  );
}
