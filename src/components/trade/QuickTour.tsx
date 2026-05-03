import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, Users, FileText, X, ArrowRight, ArrowLeft, Check, Sparkles, Image as ImageIcon, Box, Compass, BookOpen, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Step = {
  id: string;
  path: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  ctaLabel: string;
};

// Maps DB icon name → lucide component. Unknown names fall back to MapPin.
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin, Users, FileText, Sparkles, Image: ImageIcon, Box, Compass, BookOpen, FolderOpen,
};

const DEFAULT_STEPS: Step[] = [
  { id: "showroom",  path: "/trade/showroom",  title: "1. Browse the Showroom",            body: "Start here to explore curated rooms in situ. Click any hotspot on a photo to open the piece, see specs, trade pricing and add it to a tearsheet.", icon: MapPin,   ctaLabel: "Next: Designers" },
  { id: "designers", path: "/trade", title: "2. Discover Designers & Ateliers",  body: "From your dashboard, open the Designers & Ateliers Library tile (highlighted) to filter 274 designers across 32 ateliers by category, country or material — and shop their pieces.", icon: Users,    ctaLabel: "Next: Brief setup" },
  { id: "brief",     path: "/trade/quotes",    title: "3. Set up a brief",                  body: "Build a tearsheet or quote for your client. You can also ask the AI Concierge to start from a brief — it will scope your project and propose pieces automatically.", icon: FileText, ctaLabel: "Next: Tools" },
  { id: "tools",     path: "/trade/tools",     title: "4. Your specification toolkit",      body: "Everything you need to take a quote from idea to delivery lives here: Mood Board for client presentations, Tearsheet Builder for printable specs, Markup & Annotation for drawings, FF&E Schedule, Product Comparator, Floor Plan → FF&E and more. Bookmark this page — you'll come back often.", icon: Sparkles, ctaLabel: "Finish tour" },
];

const STORAGE_KEY = "trade_quick_tour_step";
export const TOUR_DONE_KEY = "trade_quick_tour_done";

export function QuickTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [STEPS, setSteps] = useState<Step[]>(DEFAULT_STEPS);

  // Load tour steps from DB (fall back to hard-coded defaults if empty/error)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("onboarding_tour_steps")
        .select("step_key, title, body, path, icon, cta_label, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (cancelled || !data || data.length === 0) return;
      setSteps(data.map((r: any) => ({
        id: r.step_key,
        path: r.path,
        title: r.title,
        body: r.body,
        icon: ICONS[r.icon] || MapPin,
        ctaLabel: r.cta_label,
      })));
    })();
    return () => { cancelled = true; };
  }, []);

  // Listen for the start event
  useEffect(() => {
    const onStart = () => {
      setStepIdx(0);
      setActive(true);
      try { localStorage.setItem(STORAGE_KEY, "0"); } catch {}
      navigate(STEPS[0].path);
    };
    window.addEventListener("trade-tour:start", onStart);
    return () => window.removeEventListener("trade-tour:start", onStart);
  }, [navigate]);

  // Resume across reloads / route changes if a tour was in progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const idx = parseInt(raw, 10);
      if (!Number.isFinite(idx) || idx < 0 || idx >= STEPS.length) return;
      setStepIdx(idx);
      setActive(true);
    } catch {}
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(TOUR_DONE_KEY, String(Date.now()));
    } catch {}
    window.dispatchEvent(new CustomEvent("trade-tour:done"));
  }, []);

  const next = useCallback(() => {
    const nextIdx = stepIdx + 1;
    if (nextIdx >= STEPS.length) {
      finish();
      return;
    }
    setStepIdx(nextIdx);
    try { localStorage.setItem(STORAGE_KEY, String(nextIdx)); } catch {}
    navigate(STEPS[nextIdx].path);
  }, [stepIdx, navigate, finish]);

  const back = useCallback(() => {
    if (stepIdx === 0) return;
    const prevIdx = stepIdx - 1;
    setStepIdx(prevIdx);
    try { localStorage.setItem(STORAGE_KEY, String(prevIdx)); } catch {}
    navigate(STEPS[prevIdx].path);
  }, [stepIdx, navigate]);

  // Expose current step id on <body> so target tiles can self-spotlight via CSS.
  useEffect(() => {
    if (!active) {
      document.body.removeAttribute("data-tour-step");
      return;
    }
    document.body.setAttribute("data-tour-step", STEPS[stepIdx]?.id ?? "");
    return () => { document.body.removeAttribute("data-tour-step"); };
  }, [active, stepIdx, STEPS]);

  if (!active) return null;
  const step = STEPS[stepIdx];
  const Icon = step.icon;
  // Only show the overlay when the user is actually on the matching route.
  // Otherwise the overlay would obscure navigation between steps.
  const onStepRoute = location.pathname === step.path || location.pathname.startsWith(step.path + "/");

  return (
    <>
      {/* Persistent slim progress bar at top so the user knows the tour is running */}
      <div className="fixed top-0 inset-x-0 z-[120] h-0.5 bg-muted/40 print:hidden">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${((stepIdx + (onStepRoute ? 1 : 0.5)) / STEPS.length) * 100}%` }}
        />
      </div>

      {onStepRoute && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] w-[calc(100vw-2rem)] max-w-md print:hidden animate-fade-in">
          <div key={`card-${stepIdx}`} className="rounded-2xl border border-border bg-background shadow-2xl p-4 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className="shrink-0 h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center">
                <Icon className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-body text-[10px] uppercase tracking-[0.18em] text-accent shrink-0">
                      Step {stepIdx + 1} of {STEPS.length}
                    </span>
                    <span className="font-body text-[10px] text-muted-foreground/60">·</span>
                    <h4 key={`t-${stepIdx}`} className="font-display text-sm text-foreground truncate animate-fade-in">{step.title.replace(/^\d+\.\s*/, "")}</h4>
                  </div>
                  <button
                    onClick={finish}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted -mr-1 -mt-1 shrink-0"
                    aria-label="Skip tour"
                    title="Skip tour"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Horizontal progress bar — fills as steps advance */}
                <div
                  className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={STEPS.length}
                  aria-valuenow={stepIdx + 1}
                  aria-label={`Tour progress: step ${stepIdx + 1} of ${STEPS.length}`}
                >
                  <div
                    className="h-full bg-accent transition-[width] duration-700 ease-out"
                    style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
                  />
                </div>
                <p key={`b-${stepIdx}`} className="font-body text-xs text-muted-foreground mt-3 leading-relaxed animate-fade-in">{step.body}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i < stepIdx ? "w-3 bg-accent" : i === stepIdx ? "w-6 bg-accent" : "w-3 bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={finish}
                      className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground px-2 py-1.5"
                    >
                      Skip
                    </button>
                    <button
                      onClick={back}
                      disabled={stepIdx === 0}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background hover:bg-muted px-2.5 py-1.5 font-body text-[11px] uppercase tracking-widest text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Back
                    </button>
                    <button
                      onClick={next}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1.5 font-body text-[11px] uppercase tracking-widest hover:opacity-90"
                    >
                      {stepIdx === STEPS.length - 1 ? "Finish" : "Next"}
                      {stepIdx === STEPS.length - 1 ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const startTradeQuickTour = () => {
  window.dispatchEvent(new Event("trade-tour:start"));
};
