import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { loadName } from "@/components/trade/conciergeGreeting";

/**
 * Header pill that opens the AI Concierge. Rendered globally in TradeLayout so
 * Felix is reachable from every trade page in a consistent location.
 *
 * It emits an explicit open event so an already-mounted, minimized concierge
 * is restored as well as a fully closed concierge.
 */
export function ConciergeHeaderButton() {
  const [name, setName] = useState<string>(() => loadName());

  useEffect(() => {
    const onRename = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) setName(detail);
      else setName(loadName());
    };
    window.addEventListener("concierge:name-changed", onRename);
    return () => window.removeEventListener("concierge:name-changed", onRename);
  }, []);

  const open = () => {
    window.dispatchEvent(new CustomEvent("concierge:open"));
  };

  return (
    <button
      onClick={open}
      className="hidden sm:flex items-center gap-2 rounded-full bg-foreground text-background px-3 py-1.5 shadow-sm hover:opacity-90 transition-all"
      aria-label={`Open ${name}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="font-body text-[11px] uppercase tracking-[0.15em]">{name}</span>
    </button>
  );
}
