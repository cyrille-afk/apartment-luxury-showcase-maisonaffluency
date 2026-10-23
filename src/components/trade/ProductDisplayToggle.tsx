import { Eye, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientSafeMode } from "@/lib/clientSafeMode";
export default function ProductDisplayToggle() {
  const { clientSafe, setClientSafe } = useClientSafeMode();
  return <div role="group" aria-label="Product display mode" data-felix-target="header-presentation-toggle" className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-border bg-background p-1">
    <Button type="button" variant={clientSafe ? "ghost" : "default"} aria-label="Studio Mode" aria-pressed={!clientSafe} onClick={() => setClientSafe(false)} title="Studio Mode" className="h-11 min-w-11 md:h-8 md:min-w-0 gap-2 px-2.5 font-body text-[10px] uppercase md:px-3"><PanelsTopLeft className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden md:inline">Studio Mode</span></Button>
    <Button type="button" variant={clientSafe ? "default" : "ghost"} aria-label="Presentation Mode" aria-pressed={clientSafe} onClick={() => setClientSafe(true)} title="Presentation Mode" className="h-11 min-w-11 md:h-8 md:min-w-0 gap-2 px-2.5 font-body text-[10px] uppercase md:px-3"><Eye className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden md:inline">Presentation Mode</span></Button>
  </div>;
}
