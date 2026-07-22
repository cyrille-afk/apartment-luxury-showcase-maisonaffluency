import { useEffect, useMemo, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { MobileHandoffDialog } from "./MobileHandoffDialog";

const DISMISS_KEY = "maf_mobile_banner_dismissed_v1";
const SEEN_KEY = "maf_mobile_pwa_seen";
const DESKTOP_HITS_KEY = "maf_desktop_hits";
const HITS_THRESHOLD = 3;

/**
 * Desktop-only continuity banner shown to Trade users who have been active
 * on the desktop portal but have never opened the site on mobile / installed
 * the PWA. Dismissible; hidden permanently once dismissed or once we detect
 * a mobile visit (which writes the "seen" flag).
 */
export function MobileContinuityBanner() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/trade`;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only desktop widths qualify for this nudge.
    if (window.matchMedia("(max-width: 767px)").matches) return;

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (localStorage.getItem(SEEN_KEY) === "1") return;

      // Require repeated desktop activity before showing the banner.
      const hits = Number(localStorage.getItem(DESKTOP_HITS_KEY) || "0") + 1;
      localStorage.setItem(DESKTOP_HITS_KEY, String(hits));
      if (hits >= HITS_THRESHOLD) setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className="hidden md:flex items-center gap-4 mb-6 px-4 py-3 rounded-md border border-border bg-muted/40">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background">
          <Smartphone className="h-4 w-4 text-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Desktop &rarr; Mobile
          </p>
          <p className="font-body text-sm text-foreground leading-snug mt-0.5">
            Presenting to clients on-site?{" "}
            <button onClick={() => setOpen(true)} className="underline underline-offset-2 hover:opacity-80">
              Scan this code with your mobile device
            </button>{" "}
            to install the Maison Affluency companion app for offline portfolio access.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1 rounded hover:bg-background/60"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <MobileHandoffDialog
        open={open}
        onOpenChange={setOpen}
        redirectTo={redirectTo}
        targetLabel="your trade dashboard"
      />
    </>
  );
}
