import { ensureSampleBoard } from "@/lib/sampleBoard";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Pause, Play, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAIGuideName } from "@/hooks/useAIGuideName";
import { useTierConfig, type TradeTier, type TierConfigRow } from "@/hooks/useTradeDiscount";
import { setClientSafeMode } from "@/lib/clientSafeMode";

/** Format a tier discount fraction (0.15) as "15%". */
const fmtPct = (fraction: number) => {
  const pct = fraction * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
};

/** Format a spend threshold in cents as "EUR150,000". */
const fmtEur = (cents: number) => `EUR${Math.round(cents / 100).toLocaleString("en-US")}`;

/**
 * Tour copy tokens ({silverPct}, {goldEur}, …) resolve against the live
 * `trade_tier_config` table so admin pricing changes update the tour
 * automatically — no hardcoded rates or thresholds in the walkthrough.
 */
const resolveTierTokens = (text: string, cfg: Record<TradeTier, TierConfigRow>) =>
  text
    .replace(/\{silverPct\}/g, fmtPct(cfg.silver.discount_pct))
    .replace(/\{goldPct\}/g, fmtPct(cfg.gold.discount_pct))
    .replace(/\{platinumPct\}/g, fmtPct(cfg.platinum.discount_pct))
    .replace(/\{goldEur\}/g, fmtEur(cfg.gold.min_spend_cents))
    .replace(/\{platinumEur\}/g, fmtEur(cfg.platinum.min_spend_cents));

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
      "Welcome! I am {name}, your dedicated Curatorial Assistant. I have pre-applied your Silver Tier privileges across the entire studio portfolio. Let's look at how we will manage your workspace together.",
  },
  {
    id: "collection",
    title: "Interactive Sourcing",
    target: "dashboard-showroom",
    route: "/trade",
    dialogue:
      "Explore pieces in real residential settings through the Curated Showroom. Your Silver Tier gives you a {silverPct} trade discount on eligible pieces. Click the Curated Showroom card to enter the Interactive Galleries and see your pricing in context.",
  },
  {
    id: "quotes",
    title: "Transparent Project Margins",
    target: "collection-gallery",
    route: "/trade/the-collection",
    dialogue:
      "In the Interactive Galleries, explore each room and open a product tag to see its pricing. Your Silver Tier's {silverPct} trade discount is reflected in eligible product pricing, so you can plan your project margins with clarity. Keep building your cumulative project volume toward the {goldEur} Gold Tier threshold.",
  },
  {
    id: "projects",
    title: "Client Project Folders",
    target: "nav-projects",
    route: "/trade/projects",
    dialogue:
      "Every engagement lives in its own isolated workspace. Your Singapore GCB project, for instance, keeps its collections, quotes, layouts, and client documentation fully separate from every other pipeline. Use Projects & Interventions to structure each client engagement end to end.",
  },
  {
    id: "tier-tracking",
    title: "Real-Time Tier Tracking",
    target: "tier-volume-tracker",
    route: "/trade",
    dialogue:
      "This tracker follows your rolling 12-month confirmed project spend in real time. As procurement volume accumulates across your projects, you advance toward the {goldEur} threshold, where your {goldPct} Gold Tier discount unlocks automatically — no forms, no waiting.",
  },
  {
    id: "client-safe-presentations",
    title: "Client-Safe Presentations",
    target: "header-client-view",
    route: "/trade",
    dialogue:
      "The Client View switch in the top bar transforms your entire workspace into a client-facing presentation mode. Every internal figure — trade pricing, tier discounts, supplier identities, and studio margins — is masked instantly, so you can present live on a shared screen with complete confidence.",
  },
  {
    id: "margin-protection",
    title: "Absolute Margin Protection",
    target: "collection-price-tag",
    route: "/trade/the-collection",
    dialogue:
      "With Client View active, your {silverPct} Silver Tier pricing stays safely hidden behind standard retail pricing. Your clients see only elegant, final figures — never your trade discount, never your margin. Toggle back to Trade view the moment the presentation ends.",
  },
  {
    id: "quote-generation",
    title: "Professional Quote Generation",
    target: "nav-quotes",
    route: "/trade/quotes",
    dialogue:
      "This is your Quotes & Proformas workspace. The automated document compiler turns any product selection into a polished, client-ready quotation in moments — line items, finishes, lead times, and your tier pricing assembled for you. Create a new proforma specification whenever a project is ready to formalize.",
  },
  {
    id: "direct-client-billing",
    title: "Direct Client Billing",
    target: "quotes-ledger-panel",
    route: "/trade/quotes",
    dialogue:
      "Every proforma can be exported exactly as your client should see it: a retail-facing document with elegant final figures, or a trade-facing invoice showing your studio's pricing. You choose the presentation per document — your margins stay protected either way. And every confirmed quote accumulates toward the {goldEur} threshold, moving you closer to your {goldPct} Gold Tier discount.",
  },
  {
    id: "tools",
    title: "The Trade Tools Grid",
    target: "tools-grid",
    route: "/trade/tools",
    dialogue:
      "Welcome to your studio utility deck. Here you can utilize our tailored sourcing tools, search Materials Libraries, create presentation moodboards, or request physical fabric samples.",
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
    id: "felix-chat",
    title: "Your Personal Concierge",
    target: "nav-concierge",
    route: "/trade/concierge",
    dialogue:
      "Whenever you need bespoke project curation or styling advice, look to the sidebar. Open the Trade Concierge to brief me, co-curate custom schemes, or source rare artisan pieces alongside me.",
  },
  {
    id: "client-view",
    title: "The Transition to Collaboration",
    target: "client-view-toggle",
    route: "board",
    done: () => switchOn('[aria-label="Toggle client editorial presentation"]'),
    dialogue:
      "Exceptional sourcing is only the first step; bringing your client along on the journey is where projects come to life. Let's look at how we tailor this board for your high-net-worth presentations. Click **Client View** to hide internal trade calculations.",
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
    dialogue:
      "Your custom branded workspace is ready. Click **Invite Collaborator** to send a secure, 30-day interactive portal link to your client or external contractors. When they drop feedback or swap 3D fabric finishes, their choices sync live to your master ledger.",
  },
  {
    id: "technical-assets",
    title: "Technical Design Assets",
    target: "nav-tools",
    route: "/trade/tools",
    dialogue:
      "Every piece in the catalogue carries its full technical dossier. From the Tools grid you can reach CAD blocks and BIM-ready 3D models for direct import into your drawings, download specification sheets and finish matrices, and request physical material samples — everything your technical team needs to specify with confidence.",
  },
  {
    id: "priority-concierge",
    title: "Priority Concierge Access",
    target: "felix-chat",
    route: "/trade",
    cta: "Finish Tour",
    dialogue:
      "You are never sourcing alone. I am available from the top bar on every page — brief me on any project and I will co-curate schemes, source rare artisan pieces, and assemble specification schedules with your {silverPct} Silver Tier pricing applied. And behind me stands our human operations team: for logistics, customs, and white-glove delivery, a real specialist is always one message away. Welcome aboard.",
  },
];

const renderBold = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : part,
  );

const SEEN_KEY = "felix_dashboard_tour_seen_v1";
const PROGRESS_KEY = "felix_tour_progress_v1";
const BOARD_PATH = /^\/trade\/boards\/[0-9a-f-]{36}/i;
const PAD = 10;
// Tracking must not ease behind a scrolling or collapsing target. Fade only
// the spotlight in/out; its geometry follows the measured node each frame.
const SPOTLIGHT_EASE = "opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1)";

type Rect = { top: number; left: number; width: number; height: number };
const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

export function FelixTour({ autoStart = true }: { autoStart?: boolean }) {
  const guideName = useAIGuideName();
  // Live tier config (trade_tier_config) drives every rate/threshold in the
  // tour copy, tier table, and worked example — realtime-invalidated on admin edits.
  const { data: tierCfg } = useTierConfig();
  const tiers = tierCfg ?? {
    silver: { tier: "silver", discount_pct: 0, min_spend_cents: 0, label: "Silver" },
    gold: { tier: "gold", discount_pct: 0, min_spend_cents: 0, label: "Gold" },
    platinum: { tier: "platinum", discount_pct: 0, min_spend_cents: 0, label: "Platinum" },
  } as Record<TradeTier, TierConfigRow>;
  const navigate = useNavigate();
  const location = useLocation();
  const [stepDone, setStepDone] = useState(true);
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [position, setPosition] = useState<{ step: number; path: string; rect: Rect } | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [settled, setSettled] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);

  const step = FELIX_STEPS[currentStep];
  const isLast = currentStep === FELIX_STEPS.length - 1;
  const [collectionArrived, setCollectionArrived] = useState(false);
  // The showroom card advances the step before navigation; do not redirect
  // away while its Link takes the member into the gallery.
  const stepRoute = step.id === "quotes" && collectionArrived ? location.pathname : step.route;
  const stepTarget = step.target;

  const measure = useCallback(() => {
    const s = FELIX_STEPS[currentStep];
    setStepDone(s.id === "collection" ? false : s.done ? s.done() : true);
  }, [currentStep]);

  useEffect(() => {
    if (!open) return;
    if (stepRoute !== "board") {
      if (location.pathname !== stepRoute) navigate(stepRoute);
      return;
    }
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
  }, [navigate, open, stepRoute]);

  // Advance before the card Link routes, independently of destination loading.
  useEffect(() => {
    if (!open || isPaused) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(`[data-felix-target="${stepTarget}"]`);
      if (el && step.id === "collection") {
        flushSync(() => {
          setCollectionArrived(true);
          setCurrentStep(2);
        });
        return;
      }
      if (el && step.clickFinishes) { close(true); return; }
      window.setTimeout(() => measure(), 150);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPaused, step, stepTarget, measure]);

  useLayoutEffect(() => {
    if (!open) return;
    setSettled(false);
    setStepDone(false);
    const current = FELIX_STEPS[currentStep];
    const routeReady = stepRoute === "board"
      ? BOARD_PATH.test(location.pathname)
      : location.pathname === stepRoute;
    let frame = 0;
    let last: Rect | null = null;
    let stableSince = 0;
    let ready = false;
    let didEnter = false;
    let didScroll = false;
    let missingSince = 0;
    let fallback = false;
    let watched: Element[] = [];
    let observedTarget: Element | null = null;
    let revealFrame = 0;
    const resizeObserver = new ResizeObserver(() => { stableSince = 0; });
    // React may replace a sidebar item or workspace control during navigation.
    // Wake the stability check when that specific target changes, not whenever
    // unrelated page content mutates.
    const mutationObserver = new MutationObserver(() => {
      const target = routeReady ? document.querySelector(`[data-felix-target="${stepTarget}"]`) : null;
      if (target !== observedTarget) {
        observedTarget = target;
        last = null;
        stableSince = 0;
        ready = false;
        setSettled(false);
        setPosition(null);
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    const onChange = () => {
      stableSince = 0;
      // A viewport change can alter the tooltip's available space even when
      // the target itself retains exactly the same bounding rectangle.
      setViewport((previous) => previous.w === window.innerWidth && previous.h === window.innerHeight
        ? previous : { w: window.innerWidth, h: window.innerHeight });
    };
    const tick = (now: number) => {
      const elements = routeReady
        ? Array.from(document.querySelectorAll(`[data-felix-target="${stepTarget}"]`))
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
      // Sample every frame while open: scroll containers and the sidebar's
      // width transition can move a target without resizing that target.
      // Only measure nodes that are actually mounted and laid out.
      const live = elements.filter((el) => el.isConnected && ((el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed") && getComputedStyle(el).visibility !== "hidden");
      const boxes = live.map((el) => el.getBoundingClientRect());
      const next = boxes.length ? {
        top: Math.min(...boxes.map((r) => r.top)),
        left: Math.min(...boxes.map((r) => r.left)),
        width: Math.max(...boxes.map((r) => r.right)) - Math.min(...boxes.map((r) => r.left)),
        height: Math.max(...boxes.map((r) => r.bottom)) - Math.min(...boxes.map((r) => r.top)),
      } : null;
      const commit = (r: Rect) => {
        setPosition((previous) => previous?.step === currentStep && previous.path === location.pathname && sameRect(previous.rect, r)
          ? previous : { step: currentStep, path: location.pathname, rect: r });
        setViewport((previous) => previous.w === window.innerWidth && previous.h === window.innerHeight
          ? previous : { w: window.innerWidth, h: window.innerHeight });
        fallback = r.width === 2 && r.height === 2 && !next;
        if (!ready) {
          setStepDone(current.id === "collection" ? false : current.done ? current.done() : true);
          ready = true;
          // Render at the measured position invisibly first, then fade in on
          // the next frame. Never inject a tooltip at the viewport center.
          revealFrame = requestAnimationFrame(() => setSettled(true));
        }
      };
      if (!next || next.width < 1 || next.height < 1) {
        last = null;
        stableSince = 0;
        // Target hidden (e.g. sidebar items on phones): after a grace period,
        // anchor the card to the viewport centre so the step stays usable.
        if (!missingSince) missingSince = now;
        if (!ready && routeReady && now - missingSince >= 1500) {
          commit({ top: window.innerHeight / 2 - 1, left: window.innerWidth / 2 - 1, width: 2, height: 2 });
          frame = requestAnimationFrame(tick);
          return;
        }
        if (ready && !fallback) {
          ready = false;
          cancelAnimationFrame(revealFrame);
          setSettled(false);
          setPosition(null);
        }
      } else if (ready && fallback) {
        ready = false; fallback = false; missingSince = 0;
        last = next; stableSince = now;
      } else if (ready) {
        // Already shown: redraw immediately on any movement so the box never lags.
        if (!last || !sameRect(last, next)) { last = next; commit(next); }
      } else if (!last || !sameRect(last, next)) {
        last = next;
        stableSince = now;
      } else if (now - stableSince >= 150) {
        commit(next);
      }
      frame = requestAnimationFrame(tick);
    };
    // The frame loop discovers async targets and tracks movement; the observers
    // watch node replacement and size changes without resetting stable layouts.
    frame = requestAnimationFrame(tick);
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(revealFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, currentStep, location.pathname, stepRoute, stepTarget]);

  useLayoutEffect(() => {
    if (open) document.documentElement.dataset.felixTourStep = step.id;
    else delete document.documentElement.dataset.felixTourStep;
    return () => { delete document.documentElement.dataset.felixTourStep; };
  }, [open, step.id]);

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
      // Resume where the member left off if they skipped mid-tour.
      const saved = Number(localStorage.getItem(PROGRESS_KEY));
      if (Number.isInteger(saved) && saved > 0 && saved < FELIX_STEPS.length) setCurrentStep(saved);
    } catch {}
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, [autoStart]);

  // External relaunch: window.dispatchEvent(new Event("felix-tour:start"))
  useEffect(() => {
    const onStart = () => {
      // Manual relaunch resumes from saved progress when present.
      let startAt = 0;
      try {
        const saved = Number(localStorage.getItem(PROGRESS_KEY));
        if (Number.isInteger(saved) && saved > 0 && saved < FELIX_STEPS.length) startAt = saved;
      } catch {}
      setCurrentStep(startAt);
      setCollectionArrived(false);
      setIsPaused(false);
      setOpen(true);
    };
    window.addEventListener("felix-tour:start", onStart);
    return () => window.removeEventListener("felix-tour:start", onStart);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.felixTourActive = String(open);
    window.dispatchEvent(new Event("felix-tour:state"));
    return () => {
      document.documentElement.dataset.felixTourActive = "false";
      window.dispatchEvent(new Event("felix-tour:state"));
    };
  }, [open]);

  const close = useCallback((completed: boolean) => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = null;
    setOpen(false);
    setIsPaused(false);
    setTransitioning(false);
    // Closing is an explicit skip; neither a completed nor skipped first tour
    // should keep greeting the member as new on the dashboard.
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
      // Remember where the member left off so the tour can resume there;
      // a finished tour clears any saved progress.
      if (completed) localStorage.removeItem(PROGRESS_KEY);
      else localStorage.setItem(PROGRESS_KEY, String(currentStep));
    } catch {}
  }, [currentStep]);

  const changeStep = (direction: number) => {
    if (transitioning) return;
    setTransitioning(true);
    transitionTimer.current = window.setTimeout(() => {
      setIsPaused(false);
      setCollectionArrived(false);
      setCurrentStep((s) => Math.max(0, Math.min(s + direction, FELIX_STEPS.length - 1)));
      transitionTimer.current = null;
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
  };
  const next = () => {
    if (!stepDone || !settled || transitioning) return;
    if (isLast) { close(true); return; }
    // The next frame (including route fallbacks) must already be client-safe.
    if (step.id === "client-safe-presentations") setClientSafeMode(true);
    changeStep(1);
  };
  const back = () => {
    changeStep(-1);
  };

  useEffect(() => {
    if (settled && transitioning && transitionTimer.current === null) setTransitioning(false);
  }, [settled, transitioning]);

  // Escape always closes the tour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  // No stale step or route geometry may be used while the new target mounts.
  const rect = position?.step === currentStep && position.path === location.pathname ? position.rect : null;
  // Card placement: right of the target, else left, below, or above.
  const cardW = Math.min(step.id === "welcome" ? 410 : 380, viewport.w - 32);
  // Step 1 carries the tier breakdown and needs a taller placement box.
  const cardH = step.id === "welcome" ? 545 : 320;
  const clampX = (x: number) => Math.min(Math.max(x, 16), Math.max(viewport.w - cardW - 16, 16));
  const clampY = (y: number) => Math.min(Math.max(y, 16), Math.max(viewport.h - cardH - 16, 16));
  let cardLeft = 0;
  let cardTop = 0;
  if (rect) {
    const centerY = clampY(rect.top + rect.height / 2 - cardH / 2);
    const centerX = clampX(rect.left + rect.width / 2 - cardW / 2);
    const rightX = rect.left + rect.width + PAD + 8;
    const leftX = rect.left - PAD - 8 - cardW;
    if (step.id === "client-view") {
      // Step 8: never below the switch (it would cover the product photo).
      // Right of the switch, bottom-aligned so the card grows upwards; else above.
      if (rightX + cardW <= viewport.w - 16) {
        cardLeft = rightX;
        cardTop = clampY(rect.top + rect.height - cardH);
      } else {
        cardLeft = centerX;
        cardTop = Math.max(16, rect.top - cardH - PAD - 8);
      }
    } else if (rightX + cardW <= viewport.w - 16) {
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
      className="pointer-events-none fixed z-[134] rounded-md border-2 border-accent motion-reduce:!transition-none"
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

  if (isPaused) return createPortal(
    <button
      type="button"
      onClick={() => setIsPaused(false)}
      className="fixed bottom-6 right-6 z-[132] inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-body text-[11px] uppercase tracking-widest text-foreground shadow-lg hover:bg-muted print:hidden"
      aria-label="Resume Felix tour"
    >
      <Play className="h-3 w-3" /> Resume tour
    </button>,
    document.body,
  );

  return createPortal(
    <>
      {/* Dimmed backdrop with a clear window around the target; tap dismisses when there is no spotlight */}
      {!isPaused && <div
        className={cn("fixed inset-0 z-[130] overflow-hidden print:hidden", rect ? "pointer-events-none" : "pointer-events-auto")}
        onClick={rect ? undefined : () => close(false)}
      >
        {(!rect || !settled || transitioning) && <div className="absolute inset-0 bg-foreground/40" />}
      </div>}
      {ring}

      {/* The card is not mounted until this step's actual target is measured. */}
      {rect && <div
        role="dialog"
        aria-label={`${guideName} — Your Curatorial Guide`}
        className={cn(
          "fixed z-[132] print:hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl transition-opacity duration-150 ease-out motion-reduce:transition-none",
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
              title="Close tour"
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
            <p className="font-body text-[13px] leading-relaxed text-foreground">{renderBold(resolveTierTokens(step.dialogue, tiers).replace(/\{name\}/g, guideName))}</p>
          </div>

          {/* Trade tier structure — Step 1 only */}
          {step.id === "welcome" && (
            <div className="mt-4 animate-fade-in">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Trade Tier Structure
              </p>
              <div className="mt-2 divide-y divide-border border-y border-border">
                {([
                  { key: "silver" as TradeTier, note: "Base entry tier", current: true },
                  { key: "gold" as TradeTier, note: `Unlocks at ${fmtEur(tiers.gold.min_spend_cents)} cumulative project volume`, current: false },
                  { key: "platinum" as TradeTier, note: `Unlocks at ${fmtEur(tiers.platinum.min_spend_cents)} cumulative project volume`, current: false },
                ]).map((row) => (
                  <div key={row.key} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex flex-col items-start gap-1.5 shrink-0">
                      <span className="font-display text-[13px] text-foreground whitespace-nowrap">{tiers[row.key].label} Partner</span>
                      {row.current ? (
                        <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.18em] text-accent">
                          Current Status
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right min-w-0">
                      <p className="font-display text-[13px] font-semibold tracking-tight text-foreground whitespace-nowrap">
                        {fmtPct(tiers[row.key].discount_pct)} Trade Discount
                      </p>
                      <p className="mt-0.5 font-body text-[10px] leading-snug text-muted-foreground">
                        {row.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 font-body text-[10px] italic leading-relaxed text-muted-foreground">
                Prices shown across The Collection and the interactive galleries calculate automatically based on your active {fmtPct(tiers.silver.discount_pct)} discount level.
              </p>
            </div>
          )}

          {/* Spend examples — Step 5 (tier-tracking) only */}
          {step.id === "tier-tracking" && (
            <div className="mt-4 animate-fade-in">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                How Volume Progresses — Worked Example
              </p>
              <div className="mt-2 divide-y divide-border border-y border-border">
                {(() => {
                  // Example spends derive from the live thresholds: three projects
                  // that sum exactly to the Gold unlock, then the gap to Platinum.
                  const goldC = tiers.gold.min_spend_cents;
                  const platC = tiers.platinum.min_spend_cents;
                  const p1 = Math.round(goldC * 0.32 / 100000) * 100000;
                  const p2 = Math.round(goldC * 0.3467 / 100000) * 100000;
                  const p3 = goldC - p1 - p2;
                  const eur = (c: number) => `EUR ${Math.round(c / 100).toLocaleString("en-US")}`;
                  return [
                    { project: "Three-room apartment, full curation", spend: eur(p1), running: `Running total: ${eur(p1)}` },
                    { project: "Singapore GCB, living + dining", spend: eur(p2), running: `Running total: ${eur(p1 + p2)}` },
                    { project: "Penthouse bedroom suites", spend: eur(p3), running: `Running total: ${eur(goldC)} — ${tiers.gold.label} unlocked` },
                  ];
                })().map((row) => (
                  <div key={row.project} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-display text-[13px] text-foreground">{row.project}</p>
                      <p className="mt-0.5 font-body text-[10px] leading-snug text-muted-foreground">{row.running}</p>
                    </div>
                    <p className="font-display text-[13px] font-semibold tracking-tight text-foreground whitespace-nowrap shrink-0">
                      {row.spend}
                    </p>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-display text-[13px] text-foreground">Continued volume at {fmtPct(tiers.gold.discount_pct)} {tiers.gold.label}</p>
                    <p className="mt-0.5 font-body text-[10px] leading-snug text-muted-foreground">
                      A further EUR {Math.round((tiers.platinum.min_spend_cents - tiers.gold.min_spend_cents) / 100).toLocaleString("en-US")} of confirmed spend — Running total: EUR {Math.round(tiers.platinum.min_spend_cents / 100).toLocaleString("en-US")} — {tiers.platinum.label} unlocked
                    </p>
                  </div>
                  <p className="font-display text-[13px] font-semibold tracking-tight text-foreground whitespace-nowrap shrink-0">
                    EUR {Math.round((tiers.platinum.min_spend_cents - tiers.gold.min_spend_cents) / 100).toLocaleString("en-US")}+
                  </p>
                </div>
              </div>
              <p className="mt-3 font-body text-[10px] italic leading-relaxed text-muted-foreground">
                Every confirmed quote counts toward the same rolling 12-month total — a single {fmtEur(tiers.gold.min_spend_cents)} project reaches {tiers.gold.label} on its own.
              </p>
            </div>
          )}


           {!stepDone && !isPaused && (
             <div role="status" className="mt-3 flex items-center gap-3 rounded-md bg-primary px-4 py-3 text-primary-foreground">
               <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
               <p className="font-body text-sm font-semibold leading-snug">
                 {step.id === "collection" ? "Click on the Curated Showroom card to continue." : step.id === "white-label" ? "Turn on ‘Use studio branding only’ below to unlock Next." : step.id === "client-view" ? "Switch to Client View to unlock Next." : "Use the highlighted control to continue."}
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
              onClick={() => close(false)}
              className="font-body text-[11px] uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Skip tour
            </button>
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
      </div>}
    </>,
    document.body,
  );
}

export const startFelixTour = () => {
  window.dispatchEvent(new Event("felix-tour:start"));
};
