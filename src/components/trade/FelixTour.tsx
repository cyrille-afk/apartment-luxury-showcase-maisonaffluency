import { ensureSampleBoard } from "@/lib/sampleBoard";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Pause, Play, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAIGuideName } from "@/hooks/useAIGuideName";

type FelixStep = {
  id: string;
  title: string;
  target: string; // data-felix-target selector value
  dialogue: string;
  route: string; // "board" = user's most recent board
  /** Step is complete only when this returns true (user action required). */
  done?: () => boolean;
  /** Runs on enter / each re-measure (e.g. auto-expand a panel). */
  onEnter?: () => void;
  pulse?: boolean;
  /** Clicking the highlighted element finishes the tour. */
  clickFinishes?: boolean;
  cta?: string;
};

const switchOn = (sel: string) =>
  document.querySelector(sel)?.getAttribute("data-state") === "checked";

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
      "Organize your active work by project. Keep each project's collections, quotes, layouts, and documentation together in one dedicated workspace.",
  },
  {
    id: "felix-chat",
    title: "Dynamic Design Assistance",
    target: "felix-chat",
    route: "/trade",
    dialogue:
      "Whenever you need real-time design assistance, look up here. Launch the {name} Chat at any time to co-curate collections, source hard-to-find items, or build out an entire project layout alongside me. Let's create something iconic!",
  },
  {
    id: "client-view",
    title: "The Transition to Collaboration",
    target: "client-view-toggle",
    route: "board",
    done: () => switchOn('[aria-label="Toggle client editorial presentation"]'),
    dialogue:
      "Incredible sourcing begins with smart AI curation, but enterprise victory lies in client presentation. Let's look at how you will pitch this board to your high-net-worth clients. Click **Client View** to hide internal trade calculations.",
  },
  {
    id: "branding-panel",
    title: "Unlocking Client Portal Branding",
    target: "branding-panel",
    route: "board",
    pulse: true,
    onEnter: () => {
      const d = document.querySelector<HTMLDetailsElement>('[data-felix-target="branding-panel"]');
      if (d && !d.open) d.open = true;
    },
    dialogue:
      "Maison Affluency acts as your secret operating system. Open the **Client Portal Branding** dashboard to control what your external clients and contractors experience.",
  },
  {
    id: "white-label",
    title: "Turn on studio branding",
    target: "branding-whitelabel",
    route: "board",
    pulse: true,
    onEnter: () => {
      const d = document.querySelector<HTMLDetailsElement>('[data-felix-target="branding-panel"]');
      if (d && !d.open) d.open = true;
    },
    done: () => switchOn("#hide-maison"),
    dialogue:
      "Switch on **Use studio branding only** below to remove Maison Affluency branding from your client's board. You can add your studio name and logo above.",
  },
  {
    id: "invite",
    title: "Activating the Viral Loop",
    target: "invite-collaborator",
    route: "board",
    clickFinishes: true,
    cta: "Enter My Workspace",
    dialogue:
      "Your custom branded workspace is ready. Click **Invite Collaborator** to send a secure, 30-day interactive portal link to your client or external contractors. When they drop feedback or swap 3D fabric finishes, their choices sync live to your master ledger.",
  },
];

const renderBold = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : part,
  );

const SEEN_KEY = "felix_dashboard_tour_seen_v1";
const BOARD_PATH = /^\/trade\/boards\/[0-9a-f-]{36}/i;
const PAD = 10;
const SPOTLIGHT_EASE = "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)";

type Rect = { top: number; left: number; width: number; height: number };
const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

export function FelixTour({ autoStart = true }: { autoStart?: boolean }) {
  const guideName = useAIGuideName();
  const navigate = useNavigate();
  const location = useLocation();
  const [stepDone, setStepDone] = useState(true);
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [settled, setSettled] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);

  const step = FELIX_STEPS[currentStep];
  const isLast = currentStep === FELIX_STEPS.length - 1;

  const measure = useCallback(() => {
    const s = FELIX_STEPS[currentStep];
    setStepDone(s.done ? s.done() : true);
  }, [currentStep]);

  useEffect(() => {
    if (!open) return;
    if (step.route !== "board") { navigate(step.route); return; }
    if (BOARD_PATH.test(location.pathname)) return;
    let cancelled = false;
    (async () => {
      const data = await ensureSampleBoard();
      if (cancelled) return;
      if (data?.id) navigate(`/trade/boards/${data.id}${data.project_id ? `?project=${data.project_id}` : ""}`);
      else navigate("/trade/boards");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, open, step.route]);

  // Action-required steps: re-check on any click; invite click ends the tour.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(`[data-felix-target="${step.target}"]`);
      if (el && step.clickFinishes) { close(true); return; }
      window.setTimeout(() => measure(), 150);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, measure]);

  useLayoutEffect(() => {
    if (!open) return;
    setSettled(false);
    setStepDone(false);
    const current = FELIX_STEPS[currentStep];
    const routeReady = current.route === "board"
      ? BOARD_PATH.test(location.pathname)
      : location.pathname === current.route;
    let frame = 0;
    let last: Rect | null = null;
    let stableSince = 0;
    let ready = false;
    let didEnter = false;
    let didScroll = false;
    let watched: Element[] = [];
    const startedAt = performance.now();
    const resizeObserver = new ResizeObserver(() => { stableSince = 0; });
    const onChange = () => { stableSince = 0; };
    const tick = (now: number) => {
      const elements = routeReady
        ? Array.from(document.querySelectorAll(`[data-felix-target="${current.target}"]`))
        : [];
      if (elements.length && !didEnter) {
        didEnter = true;
        current.onEnter?.();
      }
      if (elements.length && !didScroll) {
        didScroll = true;
        elements[0].scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }
      const watchedNow = [...elements, ...elements.map((el) => el.parentElement).filter((el): el is HTMLElement => el !== null)];
      if (watchedNow.length !== watched.length || watchedNow.some((el, i) => el !== watched[i])) {
        resizeObserver.disconnect();
        watchedNow.forEach((el) => resizeObserver.observe(el));
        watched = watchedNow;
        stableSince = 0;
      }
      const boxes = elements.map((el) => el.getBoundingClientRect());
      const next = boxes.length ? {
        top: Math.min(...boxes.map((r) => r.top)),
        left: Math.min(...boxes.map((r) => r.left)),
        width: Math.max(...boxes.map((r) => r.right)) - Math.min(...boxes.map((r) => r.left)),
        height: Math.max(...boxes.map((r) => r.bottom)) - Math.min(...boxes.map((r) => r.top)),
      } : null;
      if (!next || next.width < 1 || next.height < 1) {
        last = null;
        stableSince = 0;
        if (now - startedAt >= 2000) {
          // Target unavailable (e.g. sidebar hidden on mobile): show the card
          // centered without a spotlight instead of a dead dark screen.
          setRect(null);
          setViewport((previous) => previous.w === window.innerWidth && previous.h === window.innerHeight
            ? previous : { w: window.innerWidth, h: window.innerHeight });
          setStepDone(current.done ? current.done() : true);
          ready = true;
          setSettled(true);
        } else {
          ready = false;
          setSettled(false);
        }
      } else if (!last || !sameRect(last, next)) {
        last = next;
        stableSince = now;
        if (!ready) setSettled(false);
      } else if (now - stableSince >= 160) {
        setRect((previous) => previous && sameRect(previous, next) ? previous : next);
        setViewport((previous) => previous.w === window.innerWidth && previous.h === window.innerHeight
          ? previous : { w: window.innerWidth, h: window.innerHeight });
        setStepDone(current.done ? current.done() : true);
        ready = true;
        setSettled(true);
      }
      frame = requestAnimationFrame(tick);
    };
    // The frame loop discovers async targets; ResizeObserver watches only their layout.
    // Unrelated page mutations must not postpone this step forever.
    frame = requestAnimationFrame(tick);
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, currentStep, location.pathname]);

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
  }, []);

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
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
    setOpen(false);
    setIsPaused(false);
    setTransitioning(false);
    if (completed) {
      try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch {}
    }
  }, []);

  const changeStep = (direction: number) => {
    if (transitioning) return;
    setTransitioning(true);
    transitionTimer.current = window.setTimeout(() => {
      setIsPaused(false);
      setCurrentStep((s) => Math.max(0, Math.min(s + direction, FELIX_STEPS.length - 1)));
      transitionTimer.current = null;
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
  };
  const next = () => {
    if (!stepDone || !settled || transitioning) return;
    if (isLast) { close(true); return; }
    changeStep(1);
  };
  const back = () => {
    changeStep(-1);
  };

  useEffect(() => {
    if (settled && transitioning && transitionTimer.current === null) setTransitioning(false);
  }, [settled, transitioning]);

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
      data-felix-spotlight
      className="pointer-events-none fixed z-[131] rounded-md border-2 border-accent motion-reduce:!transition-none"
      style={{
        top: 0,
        left: 0,
        transform: `translate3d(${rect.left - PAD}px, ${rect.top - PAD}px, 0)`,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
        opacity: settled && !transitioning ? 1 : 0,
        transition: SPOTLIGHT_EASE,
        boxShadow: "0 0 0 100vmax hsl(var(--foreground) / 0.4), 0 0 24px hsl(var(--accent) / 0.35)",
      }}
    >{step.pulse && <span className="absolute inset-0 rounded-md border-2 border-accent animate-pulse motion-reduce:animate-none" />}</div>
  );

  return createPortal(
    <>
      {/* Dimmed backdrop with a clear window around the target */}
      {!isPaused && <div className="pointer-events-none fixed inset-0 z-[130] overflow-hidden print:hidden">
        {(!rect || !settled || transitioning) && <div className="absolute inset-0 bg-foreground/40" />}
        {ring}
      </div>}

      {/* Felix card */}
      <div
        role="dialog"
        aria-label={`${guideName} — Your Curatorial Guide`}
        className={cn(
          "fixed z-[132] print:hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
          isPaused && "opacity-90",
        )}
        style={{ width: cardW, left: 0, top: 0, transform: `translate3d(${cardLeft}px, ${cardTop}px, 0)`, opacity: settled && !transitioning ? 1 : 0, pointerEvents: settled && !transitioning ? "auto" : "none" }}
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
            <p className="font-body text-[13px] leading-relaxed text-foreground">{renderBold(step.dialogue.replace(/\{name\}/g, guideName))}</p>
          </div>

           {!stepDone && !isPaused && (
             <div role="status" className="mt-3 flex items-center gap-3 rounded-md bg-primary px-4 py-3 text-primary-foreground">
               <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
               <p className="font-body text-sm font-semibold leading-snug">
                 {step.id === "white-label" ? "Turn on ‘Use studio branding only’ below to unlock Next." : step.id === "client-view" ? "Switch to Client View to unlock Next." : "Use the highlighted control to continue."}
               </p>
             </div>
           )}

          {isPaused && (
            <p className="mt-3 font-body text-[10px] uppercase tracking-[0.18em] text-accent">
              ● Paused — highlights hidden
            </p>
          )}

          {/* Controls */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={back}
               disabled={currentStep === 0 || transitioning}
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
               disabled={!stepDone || !settled || transitioning}
              className="disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 font-body text-[11px] uppercase tracking-widest text-background hover:opacity-90"
            >
              {step.cta ?? (isLast ? "Finish" : "Next")}
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
