import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Pause, Play, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FelixStep = {
  id: string;
  title: string;
  target: string; // data-felix-target selector value
  dialogue: string;
};

const FELIX_STEPS: FelixStep[] = [
  {
    id: "welcome",
    title: "Welcome to Maison Affluency",
    target: "greeting",
    dialogue:
      "Welcome! I am Felix, your AI Curatorial Guide. Your trade account is active, and your Silver Tier benefits have been pre-applied across the portal. Let's take a quick look around.",
  },
  {
    id: "collection",
    title: "The Collection & Showrooms",
    target: "nav-collection",
    dialogue:
      "This is your primary design hub. Here, you can browse iconic pieces and see your exclusive Silver Tier trade discounts applied in real-time.",
  },
  {
    id: "quotes",
    title: "Quotes & Proformas",
    target: "nav-quotes",
    dialogue:
      "Generate bespoke client presentations here. You can group pieces by specific residential projects and export verified proforma invoices with one click.",
  },
  {
    id: "status",
    title: "Preferred Trade Status",
    target: "account-panel",
    dialogue:
      "Review your tier status milestones, transaction history, and active trade perks at any time right here. Feel free to explore!",
  },
];

const SEEN_KEY = "felix_dashboard_tour_seen_v1";
const PAD = 10;

type Rect = { top: number; left: number; width: number; height: number };

export function FelixTour({ autoStart = true }: { autoStart?: boolean }) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const step = FELIX_STEPS[currentStep];
  const isLast = currentStep === FELIX_STEPS.length - 1;

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const el = document.querySelector(`[data-felix-target="${FELIX_STEPS[currentStep].target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [currentStep]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
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

  // Card placement: prefer right of the target, then below, then above.
  const cardW = Math.min(380, viewport.w - 32);
  let cardLeft = 16;
  let cardTop = 16;
  if (rect) {
    const rightX = rect.left + rect.width + PAD + 8;
    if (rightX + cardW <= viewport.w - 16) {
      cardLeft = rightX;
      cardTop = Math.min(Math.max(rect.top, 16), viewport.h - 320);
    } else if (rect.top + rect.height + 300 < viewport.h) {
      cardLeft = Math.min(Math.max(rect.left, 16), viewport.w - cardW - 16);
      cardTop = rect.top + rect.height + PAD + 8;
    } else {
      cardLeft = Math.min(Math.max(rect.left, 16), viewport.w - cardW - 16);
      cardTop = Math.max(rect.top - 300 - PAD, 16);
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
        aria-label="Felix — Your Curatorial Guide"
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
                  Felix — Your Curatorial Guide
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
            <p className="font-body text-[13px] leading-relaxed text-foreground">{step.dialogue}</p>
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
