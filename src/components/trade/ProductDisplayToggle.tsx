import { Eye, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientSafeMode } from "@/lib/clientSafeMode";
export default function ProductDisplayToggle() {
  const { clientSafe, setClientSafe } = useClientSafeMode();
  return <div role="group" aria-label="Product display mode" className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-border bg-background p-1">
    <Button type="button" variant={clientSafe ? "ghost" : "default"} aria-pressed={!clientSafe} onClick={() => setClientSafe(false)} className="h-8 gap-2 px-2.5 font-body text-[10px] uppercase md:px-3"><PanelsTopLeft className="h-3.5 w-3.5" aria-hidden="true" />Studio Mode</Button>
    <Button type="button" variant={clientSafe ? "default" : "ghost"} aria-pressed={clientSafe} onClick={() => setClientSafe(true)} className="h-8 gap-2 px-2.5 font-body text-[10px] uppercase md:px-3"><Eye className="h-3.5 w-3.5" aria-hidden="true" />Presentation Mode</Button>
  </div>;
}
