import { Eye, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { cn } from "@/lib/utils";

/** The shared presentation switch; its external-store update masks trade data before React repaints. */
export default function ClientViewToggle({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { clientSafe, setClientSafe } = useClientSafeMode();

  return (
    <Button
      type="button"
      variant="outline"
      role="switch"
      aria-label="Client View"
      aria-checked={clientSafe}
      title={clientSafe ? "Return to Studio Workspace" : "Enter Client View"}
      onClick={() => setClientSafe(!clientSafe)}
      className={cn(
        "h-9 rounded-full border-border px-3.5 font-body text-[11px] uppercase tracking-[0.12em] transition-[background-color,color,border-color] duration-300 focus-visible:ring-2 focus-visible:ring-ring",
        clientSafe
          ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
          : "bg-background text-foreground hover:bg-muted hover:text-foreground",
        iconOnly && "w-9 shrink-0 px-0 cursor-pointer",
        className,
      )}
    >
      {clientSafe ? <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" /> : <Eye aria-hidden="true" className="h-3.5 w-3.5" />}
      <span className={iconOnly ? "sr-only" : undefined}>{clientSafe ? "Client View Active" : "Studio Workspace"}</span>
    </Button>
  );
}