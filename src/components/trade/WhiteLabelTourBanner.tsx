import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { startFelixTour } from "@/components/trade/FelixTour";

const TOUR_SEEN_KEY = "felix_dashboard_tour_seen_v1";
const DISMISS_KEY = "felix_whitelabel_banner_dismissed_v1";

/** Shown only to users who finished the walkthrough before the white-label steps existed. */
export function WhiteLabelTourBanner() {
  const [visible, setVisible] = useState(() => {
    try {
      const seen = Number(localStorage.getItem(TOUR_SEEN_KEY) || 0);
      return seen > 0 && seen < Date.parse("2026-09-27T08:00:00Z") && !localStorage.getItem(DISMISS_KEY);
    } catch { return false; }
  });
  if (!visible) return null;
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setVisible(false);
  };
  return (
    <div className="mb-8 flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <button
        type="button"
        onClick={() => { dismiss(); startFelixTour(); }}
        className="flex-1 text-left font-body text-sm text-foreground hover:underline"
      >
        <span className="font-semibold">New Enterprise Feature:</span> White-label your client presentations. Click here to restart the Felix walkthrough and set up your studio branding.
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
