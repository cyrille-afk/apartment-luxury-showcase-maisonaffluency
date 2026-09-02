import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  SHIPPING_COUNTRIES,
  isoToFlag,
  setDestination,
  useShippingDestination,
} from "@/lib/shippingDestination";

/** Key destinations surfaced first in the compact cart selector. */
const PRIORITY_ISO = ["US", "GB", "FR", "DE", "IT", "CH", "AE", "SG", "HK", "AU"];

/**
 * Minimalist "Shipping to: …" indicator with an inline dropdown.
 * Writes through to the global shipping destination (localStorage + events),
 * so the freight estimate, order total and the checkout page all follow.
 */
export function ShippingCountryIndicator({ className = "" }: { className?: string }) {
  const dest = useShippingDestination();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const priority = PRIORITY_ISO.map((iso) =>
    SHIPPING_COUNTRIES.find((c) => c.iso === iso),
  ).filter(Boolean) as typeof SHIPPING_COUNTRIES;
  const rest = SHIPPING_COUNTRIES.filter((c) => !PRIORITY_ISO.includes(c.iso));
  const options = [...priority, ...rest];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="font-body text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Shipping to:{" "}
        <span className="border-b border-border/80 pb-px hover:border-foreground">
          {dest.name}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-2 max-h-64 w-56 overflow-y-auto border border-border bg-background shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]"
        >
          {options.map((c) => {
            const active = c.iso === dest.iso;
            return (
              <button
                key={c.iso}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setDestination(c.iso);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[11px] tracking-[0.04em] transition-colors hover:bg-muted/60 ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="text-[13px] leading-none">{isoToFlag(c.iso)}</span>
                <span className="flex-1 truncate">{c.name}</span>
                {active && <Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ShippingCountryIndicator;
