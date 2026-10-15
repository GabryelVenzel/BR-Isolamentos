import ModuleSubNav from "@/components/ModuleSubNav";
import { ENGENHARIA_SUBNAV } from "@/lib/module-nav";

export default function EngenhariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ModuleSubNav items={ENGENHARIA_SUBNAV} />
      {children}
    </div>
  );
}
