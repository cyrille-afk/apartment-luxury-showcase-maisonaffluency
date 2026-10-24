import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowUpRight, ChevronDown, X } from "lucide-react";

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
 * Concise post-tour orientation for new trade members. Renders as a single
 * collapsed header row by default ("Getting Started — View Dashboard Guide")
 * so it never pushes the showroom and catalogue grids down the viewport;
 * clicking the header slides the six-area directory open. Appears once the
 * Felix tour has been finished or skipped, and stays hidden once dismissed.
 */
export const DashboardWelcomeGuide = () => {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

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
      className="mb-8 md:mb-12 border-b border-border"
    >
      <div className="flex items-center justify-between gap-4 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="dashboard-guide-panel"
          className="group flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
        >
          <span className="min-w-0 truncate font-body text-sm md:text-[15px]">
            <span className="trade-micro-label uppercase tracking-[0.2em] text-muted-foreground">
              Getting Started
            </span>
            <span aria-hidden className="mx-2 text-muted-foreground/60">—</span>
            <span className="text-foreground transition-colors group-hover:text-[hsl(var(--felix-bronze-ink))]">
              View Dashboard Guide
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:text-foreground ${open ? "rotate-180" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss welcome guide"
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        id="dashboard-guide-panel"
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <ul className="grid gap-x-8 gap-y-4 pb-6 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </div>
    </aside>
  );
};

export default DashboardWelcomeGuide;
