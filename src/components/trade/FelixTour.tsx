import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Pause, Play, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAIGuideName } from "@/hooks/useAIGuideName";

type FelixStep = {
  id: string;
  title: string;
  target: string; // data-felix-target selector value
  dialogue: string;
  route: string;
};

const FELIX_STEPS: FelixStep[] = [
  {
    id: "welcome",
    title: "Welcome & Trade Tier Validation",
    target: "greeting",
    route: "/trade",
    dialogue:
      "Welcome! I am {name}, your AI Curatorial Guide. Your Silver Tier benefits are pre-applied across the entire platform. Let's look at how you'll manage your workflow.",
  },
  {
    id: "collection",
    title: "Sourcing 'The Collection'",
    target: "nav-collection",
    route: "/trade/the-collection",
    dialogue:
      "This is your primary design hub. Click here to browse our Curated Showroom and Full Catalogue with your Silver Tier trade pricing live.",
  },
  {
    id: "quotes",
    title: "Financial Management",
    target: "nav-quotes",
    route: "/trade/quotes",
    dialogue:
      "Manage your business transactions here. Track deposit pipelines, open balances, and instantly export beautiful proforma documents for client approval.",
  },
  {
    id: "tools",
    title: "The Trade Tools Grid",
    target: "tools-grid",
    route: "/trade/tools",
    dialogue:
      "Welcome to your studio utility deck. Here you can utilize our Curation widgets, search Materials Libraries, create Moodboards, run a Product Comparator, or request physical fabric samples.",
  },
  {
    id: "settings",
    title: "Account & Team Configurations",
    target: "nav-settings",
    route: "/trade/settings",
    dialogue:
      "Configure your trade preferences, update your design practice details, manage team seats, and view your progressive tier thresholds here.",
  },
  {
    id: "projects",
    title: "Project Structuring",
    target: "nav-projects",
    route: "/trade/projects",
    dialogue:
      "Organize your active jobs dynamically. You can bucket your collections, quotes, and layouts by specific residential workflows, such as your Singapore GCB or Hamptons projects.",
  },
  {
    id: "felix-chat",
    title: "Dynamic Design Assistance",
    target: "felix-chat",
    route: "/trade",
    dialogue:
      "Finally, whenever you need real-time design assistance, look up here. Launch the {name} Chat at any time to co-curate collections, source hard-to-find items, or build out an entire project layout alongside me. Let's create something iconic!",
  },
];

const SEEN_KEY = "felix_dashboard_tour_seen_v1";
const PAD = 10;

type Rect = { top: number; left: number; width: number; height: number };

export function FelixTour({ autoStart = true }: { autoStart?: boolean }) {
  const guideName = useAIGuideName();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const step = FELIX_STEPS[currentStep];
  const isLast = currentStep === FELIX_STEPS.length - 1;

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const elements = Array.from(document.querySelectorAll(`[data-felix-target="${FELIX_STEPS[currentStep].target}"]`));
    if (elements.length === 0) {
      setRect(null);
      return;
    }
    const rects = elements.map((element) => element.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top));
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    setRect({ top, left, width: right - left, height: bottom - top });
  }, [currentStep]);

  useEffect(() => {
    if (!open) return;
    navigate(step.route);
  }, [navigate, open, step.route]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const onChange = () => measure();
    const observer = new MutationObserver(onChange);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, measure]);

  // Auto-open once for first-time trade members, unless the page tour is running.
  useEffect(() => {
    if (!autoStart) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
      if (localStorage.getItem("trade_quick_tour_step")) return;
      if (!localStorage.getItem("trade_quick_tour_done")) return; // let the page tour lead first
    } catch {}
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, [autoStart]);

  // External relaunch: window.dispatchEvent(new Event("felix-tour:start"))
  useEffect(() => {
    const onStart = () => {
      setCurrentStep(0);
      setIsPaused(false);
      setOpen(true);
    };
    window.addEventListener("felix-tour:start", onStart);
    return () => window.removeEventListener("felix-tour:start", onStart);
  }, []);

  const close = useCallback((completed: boolean) => {
    setOpen(false);
    setIsPaused(false);
    if (completed) {
      try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch {}
    }
  }, []);

  const next = () => {
    if (isLast) { close(true); return; }
    setIsPaused(false);
    setCurrentStep((s) => Math.min(s + 1, FELIX_STEPS.length - 1));
  };
  const back = () => {
    setIsPaused(false);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  if (!open || typeof document === "undefined") return null;

  // Card placement: centered on the target — right of it, else below, else above.
  const cardW = Math.min(380, viewport.w - 32);
  const cardH = 320;
  const clampX = (x: number) => Math.min(Math.max(x, 16), Math.max(viewport.w - cardW - 16, 16));
  const clampY = (y: number) => Math.min(Math.max(y, 16), Math.max(viewport.h - cardH - 16, 16));
  let cardLeft = clampX((viewport.w - cardW) / 2);
  let cardTop = clampY((viewport.h - cardH) / 2);
  if (rect) {
    const centerY = clampY(rect.top + rect.height / 2 - cardH / 2);
    const centerX = clampX(rect.left + rect.width / 2 - cardW / 2);
    const rightX = rect.left + rect.width + PAD + 8;
    const leftX = rect.left - PAD - 8 - cardW;
    if (rightX + cardW <= viewport.w - 16) {
      cardLeft = rightX;
      cardTop = centerY;
    } else if (leftX >= 16) {
      cardLeft = leftX;
      cardTop = centerY;
    } else if (rect.top + rect.height + PAD + 8 + cardH <= viewport.h - 16) {
      cardLeft = centerX;
      cardTop = rect.top + rect.height + PAD + 8;
    } else {
      cardLeft = centerX;
      cardTop = clampY(rect.top - cardH - PAD - 8);
    }
  }

  const ring = rect && !isPaused && (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[131] rounded-md border-2 border-accent transition-all duration-300 ease-out"
      style={{
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
        boxShadow: "0 0 0 4px hsl(var(--accent) / 0.15), 0 0 24px hsl(var(--accent) / 0.35)",
      }}
    />
  );

  return createPortal(
    <>
      {/* Dimmed backdrop with a clear window around the target */}
      {!isPaused && (
        <div className="fixed inset-0 z-[130] print:hidden" onClick={() => close(false)}>
          {rect ? (
            <>
              <div className="absolute inset-x-0 top-0 bg-foreground/40" style={{ height: Math.max(rect.top - PAD, 0) }} />
              <div
                className="absolute inset-x-0 bg-foreground/40"
                style={{ top: rect.top + rect.height + PAD, bottom: 0 }}
              />
              <div
                className="absolute bg-foreground/40"
                style={{ top: rect.top - PAD, left: 0, width: Math.max(rect.left - PAD, 0), height: rect.height + PAD * 2 }}
              />
              <div
                className="absolute bg-foreground/40"
                style={{
                  top: rect.top - PAD,
                  left: rect.left + rect.width + PAD,
                  right: 0,
                  height: rect.height + PAD * 2,
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-foreground/40" />
          )}
        </div>
      )}
      {ring}

      {/* Felix card */}
      <div
        role="dialog"
        aria-label={`${guideName} — Your Curatorial Guide`}
        className={cn(
          "fixed z-[132] print:hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl transition-opacity duration-300",
          isPaused && "opacity-90",
        )}
        style={{ width: cardW, left: cardLeft, top: cardTop }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-accent" />
              </span>
              <div className="min-w-0">
                <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {guideName} — Your Curatorial Guide
                </p>
                <h4 className="font-display text-base text-foreground leading-snug">{step.title}</h4>
              </div>
            </div>
            <button
              onClick={() => close(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted -mr-1 -mt-1 shrink-0"
              aria-label="Close tour"
              title="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="mt-4 flex items-center gap-3">
            <div
              className="h-1 flex-1 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={FELIX_STEPS.length}
              aria-valuenow={currentStep + 1}
            >
              <div
                className="h-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / FELIX_STEPS.length) * 100}%` }}
              />
            </div>
            <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0">
              Step {currentStep + 1} of {FELIX_STEPS.length}
            </span>
          </div>

          {/* Dialogue */}
          <div
            key={currentStep}
            className={cn(
              "mt-4 rounded-xl rounded-tl-sm bg-muted px-4 py-3 animate-fade-in",
              isPaused && "opacity-50",
            )}
          >
            <p className="font-body text-[13px] leading-relaxed text-foreground">{step.dialogue.replace(/\{name\}/g, guideName)}</p>
          </div>

          {isPaused && (
            <p className="mt-3 font-body text-[10px] uppercase tracking-[0.18em] text-accent">
              ● Paused — highlights hidden
            </p>
          )}

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={back}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-body text-[11px] uppercase tracking-widest text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-body text-[11px] uppercase tracking-widest text-foreground hover:bg-muted"
              aria-pressed={isPaused}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 font-body text-[11px] uppercase tracking-widest text-background hover:opacity-90"
            >
              {isLast ? "Finish" : "Next"}
              {isLast ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export const startFelixTour = () => {
  window.dispatchEvent(new Event("felix-tour:start"));
};
