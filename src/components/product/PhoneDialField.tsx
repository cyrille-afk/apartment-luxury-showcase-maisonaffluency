import { useEffect, useMemo, useRef, useState } from "react";
import {
  COUNTRY_DIAL_OPTIONS,
  getDialCodeByIso,
} from "@/lib/phonePlaceholder";
import { detectCountryCode } from "@/hooks/useShippingCountry";

/**
 * PhoneDialField — low-profile phone entry for the bespoke modal.
 *
 * The dial prefix is text-only (no flags, no select chrome), separated from
 * the number field by a single hairline rule, and pre-populated from the
 * visitor's detected country (IP-geo cache → browser locale).
 */
interface PhoneDialFieldProps {
  /** Full value, e.g. "+65 9123 4567". */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const DIALS = [...COUNTRY_DIAL_OPTIONS].sort((a, b) =>
  a.country.localeCompare(b.country),
);

const detectInitialDial = (): string =>
  getDialCodeByIso(detectCountryCode()) || "+65";

export default function PhoneDialField({
  value,
  onChange,
  placeholder = "9123 4567",
}: PhoneDialFieldProps) {
  const [dial, setDial] = useState<string>(detectInitialDial);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const national = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith(dial)) return trimmed.slice(dial.length).trim();
    return trimmed.replace(/^\+\d+\s*/, "");
  }, [value, dial]);

  const emit = (nextDial: string, nextNational: string) =>
    onChange(nextNational ? `${nextDial} ${nextNational}` : "");

  return (
    <div ref={wrapRef} className="relative mt-2">
      <div className="flex h-11 w-full items-center border border-border/60 bg-background focus-within:ring-1 focus-within:ring-foreground/40">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="h-full shrink-0 px-3 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {dial}
        </button>
        <span aria-hidden className="h-5 w-px bg-border/70" />
        <input
          type="tel"
          autoComplete="tel"
          value={national}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw.trim().startsWith("+")) {
              const matched = [...DIALS]
                .sort((a, b) => b.dial.length - a.dial.length)
                .find((o) => raw.trim().startsWith(o.dial));
              if (matched) {
                setDial(matched.dial);
                emit(matched.dial, raw.trim().slice(matched.dial.length).trim());
                return;
              }
            }
            emit(dial, raw.replace(/[^\d\s\-().]/g, ""));
          }}
          placeholder={placeholder}
          className="h-full flex-1 bg-transparent px-3 font-body text-sm focus:outline-none"
        />
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto border border-border/60 bg-background shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]"
        >
          {DIALS.map((o) => (
            <button
              key={`${o.country}-${o.dial}`}
              type="button"
              role="option"
              aria-selected={o.dial === dial}
              onClick={() => {
                setDial(o.dial);
                emit(o.dial, national);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left font-body text-[11px] tracking-[0.04em] transition-colors hover:bg-muted/60 ${
                o.dial === dial ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="truncate">{o.country}</span>
              <span className="ml-3 shrink-0">{o.dial}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
