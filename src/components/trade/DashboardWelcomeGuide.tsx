import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowUpRight, X } from "lucide-react";

const DISMISS_KEY = "ma_dashboard_guide_dismissed_v1";

const FEATURES = [
  { title: "The Collection", to: "/trade/the-collection", blurb: "Browse the full catalogue with live trade pricing." },
  { title: "Quotes & Proformas", to: "/trade/quotes", blurb: "Turn any selection into a branded client quote." },
  { title: "Projects", to: "/trade/projects", blurb: "Organise boards, clients and collaborations." },
  { title: "Trade Concierge", to: "/trade/concierge", blurb: "Brief Felix for sourcing and curated shortlists." },
  { title: "Tools", to: "/trade/tools", blurb: "Spec sheets, samples and technical assets." },
  { title: "Settings", to: "/trade/settings", blurb: "Studio identity, team access and preferences." },
];

/**
 * Concise post-tour orientation for new trade members: a compact, dismissible
 * map of the six key workspace areas. Appears once the Felix tour has been
 * finished or skipped (the same signal that flips the greeting to "Welcome
 * back"), and stays hidden once dismissed.
 */
export const DashboardWelcomeGuide = () => {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const seenTour = () => {
      try { return !!localStorage.getItem("felix_dashboard_tour_seen_v1"); } catch { return false; }
    };
    const sync = () => setEligible(seenTour());
    sync();
    window.addEventListener("felix-tour:state", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("felix-tour:state", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { /* storage optional */ }
  }, []);

  if (eligible === null || !eligible || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage optional */ }
  };

  return (
    <aside
      aria-label="Welcome guide"
      className="mb-8 md:mb-12 rounded-md border border-border bg-muted/40 px-5 py-5 md:px-7 md:py-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="trade-micro-label font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Getting started
          </p>
          <h2 className="mt-2 font-display text-lg md:text-xl text-foreground">
            Where everything lives
          </h2>
          <p className="mt-1 font-body text-xs text-muted-foreground">
            The six areas you'll use most — bookmarked here for your first weeks.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss welcome guide"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.to} className="min-w-0">
            <Link to={f.to} className="group inline-flex min-w-0 items-baseline gap-1.5">
              <span className="font-body text-[13px] font-medium text-foreground underline-offset-4 group-hover:underline">
                {f.title}
              </span>
              <ArrowUpRight aria-hidden className="h-3 w-3 shrink-0 translate-y-0.5 text-muted-foreground transition-colors group-hover:text-foreground" />
            </Link>
            <p className="mt-0.5 font-body text-[11px] leading-relaxed text-muted-foreground">
              {f.blurb}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default DashboardWelcomeGuide;
