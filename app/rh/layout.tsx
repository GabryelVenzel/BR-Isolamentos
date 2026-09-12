import ModuleSubNav from "@/components/ModuleSubNav";
import { RH_SUBNAV } from "@/lib/module-nav";

export default function RhLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ModuleSubNav items={RH_SUBNAV} />
      {children}
    </div>
  );
}
