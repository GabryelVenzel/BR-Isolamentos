import ModuleSubNav from "@/components/ModuleSubNav";
import { ORCAMENTO_SUBNAV } from "@/lib/module-nav";

export default function ConfigPrecosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ModuleSubNav items={ORCAMENTO_SUBNAV} />
      {children}
    </div>
  );
}
