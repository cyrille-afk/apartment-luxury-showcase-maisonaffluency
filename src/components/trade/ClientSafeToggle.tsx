import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * One-tap switch that strips net pricing and discounts from the interface
 * before the phone is handed to a client.
 */
const ClientSafeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { clientSafe, setClientSafe } = useClientSafeMode();

  return (
    <button
      type="button"
      aria-pressed={clientSafe}
      onClick={() => {
        const next = !clientSafe;
        setClientSafe(next);
        if (navigator.vibrate) navigator.vibrate(12);
        toast.success(next ? "Client-safe mode on — net pricing hidden" : "Client-safe mode off");
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.16em] transition-colors touch-manipulation",
        clientSafe
          ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold))] text-background"
          : "border-border text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {clientSafe ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      Client-safe{clientSafe ? " on" : ""}
    </button>
  );
};

export default ClientSafeToggle;
