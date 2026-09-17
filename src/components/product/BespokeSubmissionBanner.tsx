import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const BESPOKE_GUEST_EVENT = "ma:bespoke-submitted-guest";

/**
 * Inline confirmation banner shown at the top of the product canvas after a
 * guest / unverified visitor submits bespoke specifications. Felix never
 * mounts for these sessions — the concierge replies by email instead.
 */
export default function BespokeSubmissionBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onSubmitted = () => {
      setVisible(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener(BESPOKE_GUEST_EVENT, onSubmitted);
    return () => window.removeEventListener(BESPOKE_GUEST_EVENT, onSubmitted);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 20000);
    return () => clearTimeout(t);
  }, [visible]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[10001] flex justify-center px-4 pt-4 transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "-translate-y-3 opacity-0"
      )}
      aria-live="polite"
    >
      {visible && (
        <div className="pointer-events-auto w-full max-w-2xl border border-border/60 bg-background/95 px-5 py-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <div className="flex items-start gap-4">
            <p className="flex-1 font-body text-sm leading-relaxed text-foreground">
              Specifications submitted. Our Concierge team has routed your details to the workshop. A
              preliminary estimate will be sent to your email within 48 hours.
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setVisible(false)}
              className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
          <Link
            to="/trade-program"
            className="mt-3 inline-flex font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          >
            [ Join our Trade Program to unlock real-time tracking ]
          </Link>
        </div>
      )}
    </div>,
    document.body
  );
}
