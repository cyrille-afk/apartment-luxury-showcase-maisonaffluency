import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, ArrowRight } from "lucide-react";
import { MobileHandoffDialog } from "./MobileHandoffDialog";

/**
 * "Take It on the Go" profile widget — shown in the /trade/me right rail on
 * desktop. Renders a static decorative QR thumbnail (not a real signed link)
 * so the block feels alive without minting a token before the user asks.
 * Clicking expands into the full modal that mints a real one-time magic link.
 */
export function MobileHandoffWidget() {
  const [open, setOpen] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/trade/me`;
  }, []);

  useEffect(() => {
    // Decorative preview — encodes the site homepage, not the magic link.
    QRCode.toDataURL(`${window.location.origin}/trade`, {
      margin: 1,
      width: 160,
      errorCorrectionLevel: "L",
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then(setThumb)
      .catch(() => setThumb(null));
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:block w-full text-left border border-border rounded-lg p-5 hover:border-foreground/30 transition-colors group"
      >
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 rounded-md bg-white border border-border overflow-hidden flex items-center justify-center">
            {thumb ? (
              <img src={thumb} alt="" className="w-full h-full" aria-hidden />
            ) : (
              <Smartphone className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Continuity
            </p>
            <h3 className="font-display text-base text-foreground mt-0.5 leading-snug">
              Take it on the go
            </h3>
            <p className="font-body text-xs text-muted-foreground mt-1 leading-snug">
              Leaving the desk? Scan to launch the mobile workspace on your phone for on-site
              client presentations.
            </p>
            <span className="inline-flex items-center gap-1 mt-2 font-body text-[11px] text-foreground/70 group-hover:text-foreground transition-colors">
              Reveal signed QR <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </button>
      <MobileHandoffDialog
        open={open}
        onOpenChange={setOpen}
        redirectTo={redirectTo}
        targetLabel="your dashboard"
      />
    </>
  );
}
