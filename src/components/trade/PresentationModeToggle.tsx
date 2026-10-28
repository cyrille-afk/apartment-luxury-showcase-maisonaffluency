import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientSafeMode } from "@/lib/clientSafeMode";

export default function PresentationModeToggle() {
  const { clientSafe, setClientSafe } = useClientSafeMode();
  return (
    <Button type="button" variant="ghost" size="sm" role="switch" aria-label="Presentation Mode" aria-checked={clientSafe}
      title={clientSafe ? "Return to Trade pricing" : "Show retail pricing only"}
      onClick={() => setClientSafe(!clientSafe)} className="h-8 px-2 font-body text-[10px] text-muted-foreground">
      <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />Presentation Mode
    </Button>
  );
}