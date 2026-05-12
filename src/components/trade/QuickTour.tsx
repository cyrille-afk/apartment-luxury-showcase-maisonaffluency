import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, Users, FileText, X, ArrowRight, ArrowLeft, Check, Sparkles, Image as ImageIcon, Box, Compass, BookOpen, FolderOpen, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { loadLang } from "@/components/trade/conciergeGreeting";
import { localizeTourStep, tourChromeCopy } from "@/lib/conciergeI18n";
import { trackTour } from "@/lib/analytics";

type StepLink = { label: string; path: string };
type Step = {
  id: string;
  path: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
  ctaLabel: string;
  links?: StepLink[];
};

const TOUR_ROUTE_OVERRIDES: Record<string, string> = {
  tools: "/trade/tools",
  procurement: "/trade/tools",
};

// Maps DB icon name → lucide component. Unknown names fall back to MapPin.
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin, Users, FileText, Sparkles, Image: ImageIcon, Box, Compass, BookOpen, FolderOpen, Smartphone,
};

// Quick-jump links exposed inside specific tour steps so users can pivot
// between sub-tools without leaving the tour card.
const STEP_LINKS: Record<string, StepLink[]> = {
  tools: [
    { label: "Mood Board", path: "/trade/mood-boards" },
    { label: "Tearsheet Builder", path: "/trade/tearsheets" },
    { label: "FF&E Schedule", path: "/trade/ffe-schedule" },
    { label: "Product Comparator", path: "/trade/comparator" },
    { label: "Floor Plan → FF&E", path: "/trade/floor-plan-ffe" },
    { label: "All Tools", path: "/trade/tools" },
  ],
  procurement: [
    { label: "Quotes", path: "/trade/quotes" },
    { label: "Order Timeline", path: "/trade/order-timeline" },
    { label: "Shipping Tracker", path: "/trade/shipping-tracker" },
    { label: "Lead Time Calendar", path: "/trade/lead-time-calendar" },
    { label: "Budget Tracker", path: "/trade/budget" },
    { label: "Reorder", path: "/trade/reorder" },
  ],
};

const DEFAULT_STEPS: Step[] = [
  { id: "showroom",  path: "/trade/showroom",  title: "1. Browse the Showroom",            body: "Start here to explore curated rooms in situ. Click any hotspot on a photo to open the piece, see specs, trade pricing and add it to a tearsheet.", icon: MapPin,   ctaLabel: "Next: Designers" },
  { id: "designers", path: "/trade", title: "2. Discover Designers & Ateliers",  body: "From your dashboard, open the Designers & Ateliers Library tile (highlighted) to filter 274 designers across 32 ateliers by category, country or material — and shop their pieces.", icon: Users,    ctaLabel: "Next: Brief setup" },
  { id: "brief",       path: "/trade/quotes",         title: "4. Set up a brief",                body: "Build a tearsheet or quote for your client. You can also ask the AI Concierge to start from a brief — it will scope your project and propose pieces automatically.", icon: FileText, ctaLabel: "Next: Tools" },
  { id: "tools",       path: "/trade/tools",          title: "5. Your specification toolkit",    body: "Everything you need to take a quote from idea to delivery lives here: Mood Board for client presentations, Tearsheet Builder for printable specs, Markup & Annotation for drawings, FF&E Schedule, Product Comparator, Floor Plan → FF&E and more. Bookmark this page — you'll come back often.", icon: Sparkles, ctaLabel: "Next: Procurement", links: STEP_LINKS.tools },
  { id: "procurement", path: "/trade/tools", title: "6. Procurement & delivery",        body: "Once a quote is approved, this is where you run the project: track every order on the Order Timeline, monitor shipments on the Shipping Tracker, plan installs with the Lead Time Calendar, keep budgets on the Budget Tracker, and one-click reorders from past projects on Reorder. Everything stays linked to the originating quote and project.", icon: Compass, ctaLabel: "Finish tour", links: STEP_LINKS.procurement },
];

const STORAGE_KEY = "trade_quick_tour_step";
export const TOUR_DONE_KEY = "trade_quick_tour_done";
const SUBSTEPS_KEY = (stepId: string) => `trade_quick_tour_substeps:${stepId}`;

const loadCompletedSubsteps = (stepId: string): string[] => {
  try {
    const raw = localStorage.getItem(SUBSTEPS_KEY(stepId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
};

export function QuickTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [STEPS, setSteps] = useState<Step[]>(DEFAULT_STEPS);
  const [lang, setLang] = useState(() => loadLang());
  const [completedSubsteps, setCompletedSubsteps] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const onLang = () => setLang(loadLang());
    window.addEventListener("concierge:language", onLang as EventListener);
    window.addEventListener("storage", onLang);
    return () => {
      window.removeEventListener("concierge:language", onLang as EventListener);
      window.removeEventListener("storage", onLang);
    };
  }, []);

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
        path: TOUR_ROUTE_OVERRIDES[r.step_key] ?? r.path,
        title: r.title,
        body: r.body,
        icon: ICONS[r.icon] || MapPin,
        ctaLabel: r.cta_label,
        links: STEP_LINKS[r.step_key],
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
  }, [navigate, STEPS]);

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

  // Hydrate completed substeps for any step that has links once STEPS load.
  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const s of STEPS) {
      if (s.links && s.links.length > 0) next[s.id] = loadCompletedSubsteps(s.id);
    }
    setCompletedSubsteps(next);
  }, [STEPS]);

  const markSubstepDone = useCallback((stepId: string, path: string) => {
    setCompletedSubsteps((prev) => {
      const cur = prev[stepId] ?? [];
      if (cur.includes(path)) return prev;
      const updated = [...cur, path];
      try { localStorage.setItem(SUBSTEPS_KEY(stepId), JSON.stringify(updated)); } catch {}
      return { ...prev, [stepId]: updated };
    });
  }, []);

  // Dedup tour_step_view fires per session so refresh/back navigation don't double-count.
  const viewedStepsRef = useRef<Set<string>>(new Set());

  const finish = useCallback(() => {
    const lastId = STEPS[stepIdx]?.id ?? "unknown";
    if (stepIdx >= STEPS.length - 1) {
      trackTour.complete(lastId, STEPS.length);
    } else {
      trackTour.skip(lastId, stepIdx, STEPS.length);
    }
    setActive(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(TOUR_DONE_KEY, String(Date.now()));
    } catch {}
    window.dispatchEvent(new CustomEvent("trade-tour:done"));
  }, [stepIdx, STEPS]);

  const next = useCallback(() => {
    const nextIdx = stepIdx + 1;
    if (nextIdx >= STEPS.length) {
      finish();
      return;
    }
    setStepIdx(nextIdx);
    try { localStorage.setItem(STORAGE_KEY, String(nextIdx)); } catch {}
    navigate(STEPS[nextIdx].path);
  }, [stepIdx, STEPS, navigate, finish]);

  const back = useCallback(() => {
    if (stepIdx === 0) return;
    const prevIdx = stepIdx - 1;
    setStepIdx(prevIdx);
    try { localStorage.setItem(STORAGE_KEY, String(prevIdx)); } catch {}
    navigate(STEPS[prevIdx].path);
  }, [stepIdx, STEPS, navigate]);

  // Expose current step id on <body> so target tiles can self-spotlight via CSS.
  useEffect(() => {
    if (!active) {
      document.body.removeAttribute("data-tour-step");
      return;
    }
    const id = STEPS[stepIdx]?.id ?? "";
    document.body.setAttribute("data-tour-step", id);
    // Fire one tour_step_view per step per session (when the step actually mounts).
    if (id && !viewedStepsRef.current.has(id)) {
      viewedStepsRef.current.add(id);
      trackTour.stepView(id, stepIdx, STEPS.length);
    }
    return () => { document.body.removeAttribute("data-tour-step"); };
  }, [active, stepIdx, STEPS]);

  if (!active) return null;
  const step = STEPS[stepIdx];
  const localizedStep = localizeTourStep(step, lang);
  const chrome = tourChromeCopy(lang);
  const Icon = step.icon;
  // Only show the overlay when the user is actually on the matching route.
  // Otherwise the overlay would obscure navigation between steps.
  const onStepRoute = location.pathname === step.path || location.pathname.startsWith(step.path + "/");
  const doneSubsteps = completedSubsteps[step.id] ?? [];
  const isLastStep = stepIdx === STEPS.length - 1;
  const requiresSubsteps = false;
  const allSubstepsDone = true;
  const advanceDisabled = false;

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
        <div className="fixed bottom-6 left-4 z-[120] w-[calc(100vw-2rem)] max-w-sm md:max-w-md print:hidden animate-fade-in">
          <div key={`card-${stepIdx}`} className="rounded-2xl border border-border bg-background text-foreground shadow-2xl p-4 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className="shrink-0 h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center">
                <Icon className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-body text-[10px] uppercase tracking-[0.18em] text-accent shrink-0">
                      {chrome.stepOf(stepIdx + 1, STEPS.length)}
                    </span>
                    <span className="font-body text-[10px] text-muted-foreground/60">·</span>
                    <h4 key={`t-${stepIdx}`} className="font-display text-sm text-foreground truncate animate-fade-in">{localizedStep.title.replace(/^\d+\.\s*/, "")}</h4>
                  </div>
                  <button
                    onClick={finish}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted -mr-1 -mt-1 shrink-0"
                    aria-label="Skip tour"
                    title={chrome.skipTour}
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
                  aria-label={chrome.progress(stepIdx + 1, STEPS.length)}
                >
                  <div
                    className="h-full bg-accent transition-[width] duration-700 ease-out"
                    style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
                  />
                </div>
                <div key={`b-${stepIdx}`} className="mt-3 bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5 animate-fade-in">
                  <p className="font-body text-xs text-foreground leading-relaxed">{localizedStep.body}</p>
                </div>
                {step.links && step.links.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {step.links.map((l) => {
                      const done = doneSubsteps.includes(l.path);
                      return (
                        <button
                          key={l.path}
                          onClick={() => {
                            const subId = l.path.replace(/^\/trade\//, "").replace(/\//g, "-") || "root";
                            trackTour.subStepClick(step.id, subId, l.label, l.path);
                            markSubstepDone(step.id, l.path);
                            navigate(l.path);
                          }}
                          aria-label={`${l.label}${done ? " (completed)" : ""}`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.14em] transition-colors",
                            done
                              ? "border-accent/60 bg-accent/15 text-foreground"
                              : "border-border bg-background hover:bg-muted text-foreground",
                          )}
                        >
                          {l.label}
                          {done ? <Check className="h-2.5 w-2.5 text-accent" /> : <ArrowRight className="h-2.5 w-2.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                      {chrome.skip}
                    </button>
                    <button
                      onClick={back}
                      disabled={stepIdx === 0}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background hover:bg-muted px-2.5 py-1.5 font-body text-[11px] uppercase tracking-widest text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      {chrome.back}
                    </button>
                    <button
                      onClick={next}
                      disabled={advanceDisabled}
                      title={advanceDisabled ? `Visit all ${step.links!.length} tools to continue` : undefined}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1.5 font-body text-[11px] uppercase tracking-widest hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {isLastStep ? chrome.finish : chrome.next}
                      {isLastStep ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                    </button>
                    {requiresSubsteps && !allSubstepsDone && (
                      <span className="font-body text-[10px] text-muted-foreground ml-1 whitespace-nowrap">
                        {doneSubsteps.length}/{step.links!.length}
                      </span>
                    )}
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
