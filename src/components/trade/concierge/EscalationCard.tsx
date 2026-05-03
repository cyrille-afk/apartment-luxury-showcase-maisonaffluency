import { LifeBuoy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function EscalationCard({
  sentiment,
  intent,
  resolved,
  onAction,
}: {
  sentiment: string;
  intent: string;
  resolved?: "requested" | "dismissed";
  onAction: (action: "requested" | "dismissed") => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-muted/40 p-3.5 text-sm",
        resolved && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2.5">
        <LifeBuoy className="h-4 w-4 mt-0.5 text-foreground/70 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-foreground">
            Would you like to speak with a human concierge?
          </p>
          <p className="text-muted-foreground text-xs mt-1">
            I can hand this over to our team — they'll follow up by email shortly.
            <span className="ml-1 italic">(signal: {sentiment} · {intent})</span>
          </p>
          {!resolved && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onAction("requested")}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1.5 text-xs font-medium hover:opacity-90"
              >
                <Check className="h-3.5 w-3.5" /> Yes, notify the team
              </button>
              <button
                onClick={() => onAction("dismissed")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> No thanks
              </button>
            </div>
          )}
          {resolved === "requested" && (
            <p className="mt-2 text-xs text-foreground/80">✓ Concierge notified.</p>
          )}
          {resolved === "dismissed" && (
            <p className="mt-2 text-xs text-muted-foreground">Dismissed.</p>
          )}
        </div>
      </div>
    </div>
  );
}
