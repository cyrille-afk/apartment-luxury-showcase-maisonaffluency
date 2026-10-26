import { ensureSampleBoard } from "@/lib/sampleBoard";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { ArrowLeft, ArrowRight, Check, PanelLeft, Pause, Play, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAIGuideName } from "@/hooks/useAIGuideName";
import { useTierConfig, type TradeTier, type TierConfigRow } from "@/hooks/useTradeDiscount";
import { setClientSafeMode, useClientSafeMode } from "@/lib/clientSafeMode";
import { useTierVolumeLocale } from "@/hooks/useTierVolumeLocale";
import { useStudio } from "@/hooks/useStudio";
import { onboardingProjectForMarket } from "@/lib/onboardingProject";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StudioInitialization } from "./StudioInitialization";
import { useDesktopTradeTour } from "./useDesktopTradeTour";
import { fmtPct, resolveTierTokens, hasPendingTourStart, clearTourStartRequest, markTourCompleted, quoteWorkspaceReady } from "./felixTourUtils";
import { FELIX_STEP_SIDEBAR } from "./felixTourSidebarMap";
import { orderFelixSteps } from "./felixTourOrder";
import { chooseTourCardPlacement, collectionTourCardOrigin, collectionTourCardPlacement, tourPanelLandingScrollDelta, type TourRect } from "./felixTourPlacement";

type FelixStep = {
  id: string;
  title: string;
  target: string; // data-felix-target selector value
  /** Secondary element outlined subtly as an orientation aid (no dim cutout). */
  secondaryTarget?: string;
  /** Sidebar destination anchoring the card; page spotlight remains intact. */
  sidebarAnchor?: "collection" | "projects";
  dialogue: string;
  route: string; // "board" = user's most recent board
  /** Step is complete only when this returns true (user action required). */
  done?: () => boolean;
  /** Runs on enter / each re-measure (e.g. auto-expand a panel). */
  onEnter?: () => void;
  /** Reveal an existing feature without creating or saving any records. */
  prepare?: () => void;
  pulse?: boolean;
  /** Clicking the highlighted element finishes the tour. */
  clickFinishes?: boolean;
  cta?: string;
};

const switchOn = (sel: string) =>
  document.querySelector(sel)?.getAttribute("data-state") === "checked";

const FELIX_STEPS: FelixStep[] = orderFelixSteps<FelixStep>([
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
    title: "The Collection",
    target: "nav-collection",
    route: "/trade/the-collection",
    dialogue:
      "Open **The Collection** from your sidebar. Explore rooms in the **Interactive Gallery**, or browse **Designers & Ateliers** to access each designer’s product pages. Your Silver Tier gives you a {silverPct} trade discount on eligible pieces.",
  },
  {
    id: "quotes",
    title: "Transparent Project Margins",
    target: "collection-overview",
    sidebarAnchor: "collection",
    route: "/trade/the-collection",
    dialogue:
      "In The Collection, explore each room of the Interactive Gallery and open a product tag, or browse Designers & Ateliers and open any designer’s product pages, to see your pricing. Your Silver Tier's {silverPct} trade discount is reflected in eligible product pricing, so you can plan your project margins with clarity. Keep building your cumulative project volume toward the {goldVolume} Gold Tier threshold.",
  },
  {
    id: "projects",
    title: "Client Project Folders",
    target: "projects-workspace",
    sidebarAnchor: "projects",
    route: "/trade/projects",
    dialogue:
      "Every engagement lives in its own isolated workspace. Each folder you create maps its collections, layouts, quotes and client documentation together. Use Projects & Interventions to structure each client engagement end to end.",
  },
  {
    id: "tier-tracking",
    title: "Real-Time Tier Tracking",
    target: "tier-volume-tracker",
    route: "/trade",
    dialogue:
      "This tracker follows your rolling 12-month confirmed project spend in real time. As procurement volume accumulates across your projects, you advance toward the regional Gold Tier milestone, where your {goldPct} discount unlocks automatically — no forms, no waiting.",
  },
  {
    id: "client-safe-presentations",
    title: "Client-Safe Presentations",
    target: "header-client-view",
    route: "/trade/the-collection",
    dialogue:
      "The Client View switch in the top bar transforms your entire workspace into a client-facing presentation mode. Every internal figure — trade pricing, tier discounts, supplier identities, and studio margins — is masked instantly, so you can present live on a shared screen with complete confidence.",
  },
  {
    id: "margin-protection",
    title: "Absolute Margin Protection",
    target: "client-view-product-price",
    route: "/trade/products/sebastian-herkner-man-of-parts/praia-da-granja-coffee-table",
    dialogue:
      "With Client View active, your {silverPct} Silver Tier pricing stays safely hidden behind standard retail pricing. Your clients see only elegant, final figures — never your trade discount, never your margin. Toggle back to Trade view the moment the presentation ends.",
  },
  {
    id: "quote-generation",
    title: "Professional Quote Generation",
    target: "quotes-create",
    route: "/trade/quotes",
    prepare: () => {
      if (!document.querySelector('[data-felix-target="quotes-create"]')) {
        document.querySelector<HTMLButtonElement>('[data-felix-target="quote-back"]')?.click();
      }
    },
    dialogue:
      "This is your Quotes & Proformas workspace. The automated document compiler turns any product selection into a polished, client-ready quotation in moments — line items, finishes, lead times, and your tier pricing assembled for you. Create a new proforma specification whenever a project is ready to formalize.",
  },
  {
    id: "direct-client-billing",
    title: "Direct Client Billing",
    target: "quote-document-actions",
    route: "/trade/quotes",
    prepare: () => {
      if (!document.querySelector('[data-felix-target="quote-document-actions"]')) {
        document.querySelector<HTMLElement>('[data-felix-quote-review="available"]')?.click();
      }
    },
    dialogue:
      "These are the document controls for an existing quotation. Use **Preview PDF** to review the branded document before sharing, **Download PDF** to save it, or **Export Excel** for your procurement schedule. Review the quotation's client pricing and billing settings before sending it to your client.",
  },
  {
    id: "tools",
    title: "The Trade Tools Grid",
    target: "tools-grid",
    route: "/trade/tools",
    dialogue:
      "The **Discover** tools bring together the Gallery, Designers & Ateliers, Resources, and Material Library. Browse the catalogue, explore makers, find available supplier documents, and review finish samples from these cards.",
  },
  {
    id: "settings",
    title: "Account & Team Configurations",
    target: "settings-studio-team",
    route: "/trade/settings",
    dialogue:
      "Open **Studio & team** to update your client-facing studio identity, manage teammates, and assign their roles. Your personal account details and tier progress remain on this Account Settings page.",
  },
  {
    id: "portfolio-management",
    title: "Studio Portfolio Management",
    target: "header-project-switcher",
    route: "/trade",
    dialogue:
      "This switcher sets your active project context for supported workspace tools, including your Quotes & Proformas list. Choose an engagement to focus your work, or return to **All projects** for the complete view. Project access permissions remain separate from this filter.",
  },
  {
    id: "bespoke-commissions",
    title: "Bespoke & Custom Commissions",
    target: "custom-requests-inbox",
    route: "/trade/custom-requests",
    dialogue:
      "Your **Custom Requests** workspace tracks bespoke specifications and atelier replies. To start a request, open the relevant product and choose **Request Customisation**, then describe the dimensions, materials, and finish references you need. Return here to follow its progress.",
  },
  {
    id: "felix-chat",
    title: "Your Personal Concierge",
    target: "concierge-workspace",
    route: "/trade/concierge",
    dialogue:
      "This is your **Trade Concierge** workspace. Brief me here on your project, ask for finish or specification guidance, and co-curate a scheme from our catalogue. Your past curations remain available alongside the conversation.",
  },
  {
    id: "client-view",
    title: "The Transition to Collaboration",
    target: "client-view-toggle",
    route: "board",
    done: () => switchOn('[aria-label="Toggle client editorial presentation"]'),
    dialogue:
      "We now leave the Concierge and open one of your project boards — the same boards listed under **Projects & Interventions → Projects** in your sidebar. Exceptional sourcing is only the first step; bringing your client along on the journey is where projects come to life. Switch on **Client Editorial Presentation** to show this board without the internal trade calculations.",
  },
  {
    id: "branding-panel",
    title: "Unlocking Client Portal Branding",
    target: "branding-panel",
    secondaryTarget: "header-presentation-toggle",
    route: "board",
    pulse: true,
    onEnter: () => {
      const d = document.querySelector<HTMLDetailsElement>('[data-felix-target="branding-panel"]');
      if (d && !d.open) d.open = true;
    },
    dialogue:
      "You are now in **Client Editorial Presentation** — your sidebar is hidden so your client sees only the board. The **Client Editorial Presentation** switch outlined at the top right returns you to Studio Mode at any time. The **Client Portal Branding** panel is open for you: configure the studio name and logo your clients will see, and review the client-facing preview before sharing your board.",
  },
  {
    id: "white-label",
    title: "Turn on studio branding",
    target: "branding-whitelabel",
    secondaryTarget: "header-presentation-toggle",
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
    secondaryTarget: "header-presentation-toggle",
    route: "board",
    dialogue:
      "Open **Invite Collaborator** to enter your client's or contractor's email and choose their role. Review the invitation before sending it, or copy its secure portal link. Client feedback and finish requests appear on your board for review; opening this control does not send an invitation.",
  },
  {
    id: "technical-assets",
    title: "Technical Design Assets",
    target: "tools-resources",
    route: "/trade/tools",
    dialogue:
      "Open **Resources** for available atelier and designer catalogues, price lists, and technical sheets. Individual product pages also carry their available specification and CAD/3D downloads. Asset availability varies by piece; use the Material Library and Sample Requests tools for finish research and physical samples.",
  },
  {
    id: "priority-concierge",
    title: "Priority Concierge Access",
    target: "concierge-workspace",
    route: "/trade/concierge",
    dialogue:
      "Return to this **Trade Concierge** conversation whenever your project needs a fresh shortlist or specification guidance. Brief me on the room, finishes, and budget so we can work from the catalogue together. The Trade Concierge link in your workspace brings you back here.",
  },
  {
    id: "ai-extension-sync",
    title: "ACTIVATE YOUR AI DESIGN CO-PILOT",
    target: "extension-setup",
    route: "/trade/extension-sync",
    dialogue:
      "This is the **ChatGPT Extension Integration** setup page. Review your synced active project folders below, and follow the connection setup before staging catalogue pieces into a project. Opening this page alone does not activate the connection.",
  },
  {
    id: "pwa-install",
    title: "TAKE YOUR STUDIO ON SITE",
    target: "sidebar-pwa",
    route: "/trade",
    dialogue:
      "Hover **Mobile App Workspace** in the sidebar and scan the QR code with your phone. It signs your phone straight into your studio — add it to your home screen to keep working on your projects on site.",
  },
  {
    id: "beta-feedboard",
    title: "Your studio begins here",
    target: "greeting",
    route: "/trade",
    cta: "Initialize Studio Workspace",
    dialogue:
      "You’ve explored your workspace. Now make it your own: confirm your **studio identity**, invite your **team**, and name your **first project folder**. Your new project will be ready on the dashboard. You can share feedback anytime from the Beta Feedboard.",
  },
]);

/** Board presentation steps where the member's Client View choice is kept. */
const CLIENT_VIEW_PASSTHROUGH_STEPS = new Set(["client-view", "branding-panel", "white-label", "invite"]);

/**
 * Warm the same lazy page modules as the shared shell so navigation can
 * discover each real feature without waiting for an unrelated page chunk.
 */
const TOUR_ROUTE_CHUNKS = [
  () => import("@/pages/TradeDashboard"),
  () => import("@/pages/TradeShowroom"),
  () => import("@/pages/ProductPageContainer"),
  () => import("@/pages/TradeProductPage"),
  () => import("@/pages/TradeProjects"),
  () => import("@/pages/TradeQuotes"),
  () => import("@/pages/TradeTools"),
  () => import("@/pages/TradeSettings"),
  () => import("@/pages/TradeConcierge"),
  () => import("@/pages/TradeCustomRequests"),
  () => import("@/pages/TradeExtensionSync"),
   () => import("@/pages/TradeBoardBuilder"),
   () => import("@/pages/BetaFeedboard"),
 ];
let tourChunksWarmed = false;
const warmTourRoutes = () => {
  if (tourChunksWarmed) return;
  tourChunksWarmed = true;
  TOUR_ROUTE_CHUNKS.forEach((load) => { void load().catch(() => { tourChunksWarmed = false; }); });
};

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
  const desktop = useDesktopTradeTour();
  return desktop ? <DesktopFelixTour autoStart={autoStart} /> : null;
}

function DesktopFelixTour({ autoStart = true }: { autoStart?: boolean }) {
  const guideName = useAIGuideName();
  const { clientSafe } = useClientSafeMode();
  const projectExampleByCurrency = {
    SGD: "Singapore GCB, living + dining",
    USD: "Tribeca Luxury Loft",
    EUR: "Major residential project, living + dining",
  };
  // Live tier config (trade_tier_config) drives every rate/threshold in the
  // tour copy, tier table, and worked example — realtime-invalidated on admin edits.
  const { data: tierCfg } = useTierConfig();
  const tiers = tierCfg ?? {
    silver: { tier: "silver", discount_pct: 0, min_spend_cents: 0, label: "Silver" },
    gold: { tier: "gold", discount_pct: 0, min_spend_cents: 0, label: "Gold" },
    platinum: { tier: "platinum", discount_pct: 0, min_spend_cents: 0, label: "Platinum" },
  } as Record<TradeTier, TierConfigRow>;
  const tierVolume = useTierVolumeLocale();
  const { currentStudio } = useStudio();
  const projectTitle = onboardingProjectForMarket(tierVolume.market).name;
  const navigate = useNavigate();
  const location = useLocation();
  const [stepDone, setStepDone] = useState(true);
  const [open, setOpen] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [motionPreference, setMotionPreference] = useState(false);
  const reducedMotion = systemReducedMotion || motionPreference;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReducedMotion(media.matches);
    sync();
    try { setMotionPreference(localStorage.getItem("ma-felix-reduced-motion-v1") === "true"); } catch { /* storage unavailable */ }
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const changeMotionPreference = (value: boolean) => {
    setMotionPreference(value);
    try { localStorage.setItem("ma-felix-reduced-motion-v1", String(value)); } catch { /* storage unavailable */ }
  };
  useLayoutEffect(() => {
    if (open && reducedMotion) document.documentElement.dataset.felixReducedMotion = "true";
    else delete document.documentElement.dataset.felixReducedMotion;
    return () => { delete document.documentElement.dataset.felixReducedMotion; };
  }, [open, reducedMotion]);
  const [position, setPosition] = useState<{ step: number; path: string; rect: Rect; anchor: Rect | null; secondary: Rect | null; obstacles: TourRect[]; softObstacles: TourRect[]; featureObstacles: TourRect[]; bareObstacles: TourRect[] } | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [measuredCardHeight, setMeasuredCardHeight] = useState(0);
  const [settled, setSettled] = useState(false);
  const [targetUnavailable, setTargetUnavailable] = useState(false);
  const [targetRetry, setTargetRetry] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);
  const manualStartRef = useRef(false);
  const previousClientSafe = useRef(clientSafe);
  const stepTargetRef = useRef<Element | null>(null);

  const step = FELIX_STEPS[currentStep];
  const isLast = currentStep === FELIX_STEPS.length - 1;
  // Collection navigation always resolves to the actual Collection route.
  const stepRoute = step.route;
  const stepTarget = step.target;

  const measure = useCallback(() => {
    const s = FELIX_STEPS[currentStep];
    setStepDone(s.id === "collection" ? false : s.done ? s.done() : true);
  }, [currentStep]);

  // Client View is owned per step, not by whichever step last flipped it:
  // margin-protection must show it, the board presentation steps leave the
  // member's own choice alone, and every other step needs Trade view so its
  // sidebar/header target is visible. Runs on entry (Next, Back, resume).
  useLayoutEffect(() => {
    if (!open) return;
    const id = FELIX_STEPS[currentStep]?.id;
    // TanStack may retain the outgoing product while Quotes is pending.
    // Keep that product client-safe until the real quote control mounts.
    if (id === "quote-generation" && !quoteWorkspaceReady(location.pathname,
      Boolean(document.querySelector('[data-felix-target="quotes-create"]')))) return;
    if (id === "margin-protection") setClientSafeMode(true);
    else if (!CLIENT_VIEW_PASSTHROUGH_STEPS.has(id)) setClientSafeMode(false);
  }, [open, currentStep, location.pathname]);

  // A direct click on the header switch advances the presentation step like Next.
  // Only react to the off→on edge: Back can still revisit it.
  useLayoutEffect(() => {
    const entered = clientSafe && !previousClientSafe.current;
    previousClientSafe.current = clientSafe;
    if (entered && open && step.id === "client-safe-presentations") {
      setCurrentStep(FELIX_STEPS.findIndex(s => s.id === "margin-protection"));
    }
  }, [clientSafe, open, currentStep]);

  useEffect(() => {
    if (!open) return;
    if (stepRoute !== "board") {
      if (location.pathname !== stepRoute) navigate(stepRoute);
      return;
    }
    if (BOARD_PATH.test(location.pathname)) return;
    let cancelled = false;
    (async () => {
      const data = await ensureSampleBoard(tierVolume.market, currentStudio?.id ?? null);
      if (cancelled) return;
      if (data?.id) navigate(`/trade/boards/${data.id}${data.project_id ? `?project=${data.project_id}` : ""}`);
      else navigate("/trade/boards");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, open, stepRoute, tierVolume.market, currentStudio?.id]);

  // Advance before the card Link routes, independently of destination loading.
  useEffect(() => {
    if (!open || isPaused) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(`[data-felix-target="${stepTarget}"]${step.id === "collection" ? ', [data-felix-target="dashboard-showroom"]' : ''}`);
      if (el && step.id === "collection") {
        flushSync(() => {
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
    setTargetUnavailable(false);
    setStepDone(false);
    const current = FELIX_STEPS[currentStep];
    const routeReady = stepRoute === "board"
      ? BOARD_PATH.test(location.pathname)
      : location.pathname === stepRoute;
    let frame = 0;
    let last: Rect | null = null;
    let lastAnchor: Rect | null = null;
    let lastSecondary: Rect | null = null;
    let lastObstacles = "";
    let stableSince = 0;
    let ready = false;
    let didEnter = false;
    let didScroll = false;
    let didPanelLanding = false;
    let preparedAt = 0;
    let missingSince = 0;
    let loadingSince = 0;
    let fallback = false;
    let watched: Element[] = [];
    let observedTarget: Element | null = null;
    let revealFrame = 0;
    let lastSample = 0;
    let wake = true;
    const resizeObserver = new ResizeObserver(() => { stableSince = 0; wake = true; });
    // React may replace a sidebar item or workspace control during navigation.
    // Wake the stability check when that specific target changes, not whenever
    // unrelated page content mutates.
    const mutationObserver = new MutationObserver(() => {
      const target = routeReady ? document.querySelector(`[data-felix-target="${stepTarget}"]`) : null;
      if (target !== observedTarget) {
        observedTarget = target;
        stepTargetRef.current = target;
        last = null;
        stableSince = 0;
        ready = false;
        setSettled(false);
        setPosition(null);
        wake = true;
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    const onChange = () => {
      stableSince = 0;
      wake = true;
      // A viewport change can alter the tooltip's available space even when
      // the target itself retains exactly the same bounding rectangle.
      setViewport((previous) => previous.w === window.innerWidth && previous.h === window.innerHeight
        ? previous : { w: window.innerWidth, h: window.innerHeight });
    };
    const tick = (now: number) => {
      // Sampling every frame forced style/layout recalculation 60x/s and made
      // the whole portal lag while the tour was open. Discovery samples at
      // ~20fps; once shown, ~8fps plus immediate resize/scroll wake-ups.
      if (now - lastSample < (ready ? 120 : 50) && !wake) {
        frame = requestAnimationFrame(tick);
        return;
      }
      lastSample = now;
      wake = false;
      if (routeReady && current.prepare && now - preparedAt >= 1000) {
        preparedAt = now;
        current.prepare();
      }
      const elements = routeReady
        ? Array.from(document.querySelectorAll(`[data-felix-target="${stepTarget}"]`))
        : [];
      // Discovery also handles a lazy Quotes mount after the route effect ran.
      if (current.id === "quote-generation" && quoteWorkspaceReady(location.pathname, elements.length > 0)) {
        setClientSafeMode(false);
      }
      // Demonstrate the actual retail price, never a heading or hidden net price.
      const targets = current.id === "margin-protection"
        ? elements.filter((el) => {
            if (document.documentElement.dataset.clientView !== "active" || el.closest("[data-trade-sensitive]")) return false;
            stepTargetRef.current = el;
            return true;
          })
        : elements;
      if (targets.length && !didEnter) {
        didEnter = true;
        current.onEnter?.();
      }
      if (targets.length && !didScroll) {
        didScroll = true;
        targets[0].scrollIntoView({ block: current.id === "quotes" ? "nearest" : "center", behavior: ["collection", "quotes", "margin-protection"].includes(current.id) || document.documentElement.dataset.felixReducedMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }
      const sidebarTargets = routeReady && current.sidebarAnchor
        ? Array.from(document.querySelectorAll(`[data-tour-sidebar-anchor="${current.sidebarAnchor}"]`))
            .filter((el) => (el as HTMLElement).offsetParent !== null)
        : [];
      if (sidebarTargets.length) {
        const first = sidebarTargets[0].getBoundingClientRect();
        if (first.top < 16 || first.bottom > window.innerHeight - 24) sidebarTargets[0].scrollIntoView({ block: "nearest", behavior: "instant" });
      }
      const anchorBoxes = sidebarTargets.map((el) => el.getBoundingClientRect());
      const anchor = anchorBoxes.length ? {
        top: Math.min(...anchorBoxes.map((r) => r.top)),
        left: Math.min(...anchorBoxes.map((r) => r.left)),
        width: Math.max(...anchorBoxes.map((r) => r.right)) - Math.min(...anchorBoxes.map((r) => r.left)),
        height: Math.max(...anchorBoxes.map((r) => r.bottom)) - Math.min(...anchorBoxes.map((r) => r.top)),
      } : null;
      const anchorChanged = anchor ? !lastAnchor || !sameRect(lastAnchor, anchor) : lastAnchor !== null;
      // Orientation aid: a subtly outlined secondary element (e.g. the
      // top-right Presentation Mode switch while the sidebar is hidden).
      const secondaryEls = routeReady && current.secondaryTarget
        ? Array.from(document.querySelectorAll(`[data-felix-target="${current.secondaryTarget}"]`))
            .filter((el) => (el as HTMLElement).offsetParent !== null)
        : [];
      const secondaryNext = secondaryEls.length ? secondaryEls[0].getBoundingClientRect() : null;
      const secondaryChanged = secondaryNext ? !lastSecondary || !sameRect(lastSecondary, secondaryNext) : lastSecondary !== null;
      const watchedNow = [...targets, ...sidebarTargets, ...targets.map((el) => el.parentElement).filter((el): el is HTMLElement => el !== null)];
      if (watchedNow.length !== watched.length || watchedNow.some((el, i) => el !== watched[i])) {
        resizeObserver.disconnect();
        watchedNow.forEach((el) => resizeObserver.observe(el));
        watched = watchedNow;
        stableSince = 0;
      }
      // Sample every frame while open: scroll containers and the sidebar's
      // width transition can move a target without resizing that target.
      // Only measure nodes that are actually mounted and laid out.
      const live = targets.filter((el) => el === stepTargetRef.current || current.id !== "margin-protection")
        .filter((el) => el.isConnected && ((el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed") && getComputedStyle(el).visibility !== "hidden");
      // Opening Presentation Mode hides the sidebar and expands this panel.
      // Centering the panel alone leaves a shallow band that crops the dialogue.
      // Once the hidden card is mounted, reserve its natural content height
      // above the panel before revealing the final landing.
      const panelCardContent = cardRef.current?.firstElementChild;
      if (current.id === "branding-panel" && live.length && panelCardContent && !didPanelLanding) {
        didPanelLanding = true;
        const delta = tourPanelLandingScrollDelta({ target: live[0].getBoundingClientRect(), cardHeight: panelCardContent.scrollHeight + 2, viewportHeight: window.innerHeight });
        if (Math.abs(delta) > 1) {
          cancelAnimationFrame(revealFrame);
          setSettled(false);
          ready = false;
          last = null;
          stableSince = now;
          window.scrollBy({ top: delta, behavior: "instant" });
        }
      }
      if (current.id === "quotes" && live.length) {
        const heading = live[0].getBoundingClientRect();
        if (heading.top < 72 || heading.bottom > window.innerHeight - 24 || (heading.top > 100 && window.innerHeight < 750)) {
          window.scrollBy({ top: heading.top - 96, behavior: "instant" });
        }
      }
      // Gallery imagery may restore its previous scroll position after mount.
      // Keep the Step 7 client price within the viewport instead of spotlighting
      // a valid but offscreen bounding box.
      if (current.id === "margin-protection" && live.length) {
        const price = live[0].getBoundingClientRect();
        if (price.bottom < 72 || price.top > window.innerHeight - 72) {
          live[0].scrollIntoView({ block: "center", behavior: "instant" });
        }
      }
      const boxes = live.map((el) => el.getBoundingClientRect());
      const next = boxes.length ? {
        top: Math.min(...boxes.map((r) => r.top)),
        left: Math.min(...boxes.map((r) => r.left)),
        width: Math.max(...boxes.map((r) => r.right)) - Math.min(...boxes.map((r) => r.left)),
        height: Math.max(...boxes.map((r) => r.bottom)) - Math.min(...boxes.map((r) => r.top)),
      } : null;
      // Protect all visible page headings/tabs, not just this step's spotlight.
      const protectedElements = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"], [role="tab"], div.border-b > button, [data-felix-target="collection-overview"]'))
        .filter((el) => !el.closest('[data-felix-tour-card]') && (el as HTMLElement).offsetParent !== null);
      // The sidebar is a hard obstacle when space allows, but on short
      // viewports a card may legitimately overlap it as a last resort.
      const sidebarBoxes = Array.from(document.querySelectorAll('[data-sidebar="sidebar"]'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getBoundingClientRect());
      const inView = (r: { width: number; height: number; bottom: number; top: number; right: number; left: number }) =>
        r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      const toRect = (r: DOMRect) => ({ left: r.left, top: r.top, width: r.width, height: r.height });
      const featureOnly = [...boxes, ...anchorBoxes].filter(inView).map(toRect);
      const softObstacles = [...boxes, ...anchorBoxes, ...protectedElements.map((el) => el.getBoundingClientRect())]
        .filter(inView)
        .map(toRect);
      const obstacles = [...softObstacles, ...sidebarBoxes.filter(inView).map(toRect)];
      // A wide spotlight under full-width section headings can leave only a far
      // band, stranding the card away from the feature it explains. Keep the
      // highlighted feature, its sidebar link and the sidebar protected so the
      // card can still be placed beside them.
      const featureObstacles = [...featureOnly, ...sidebarBoxes.filter(inView).map(toRect)];
      const bareObstacles = featureOnly;
      const obstacleKey = JSON.stringify(obstacles.map((r) => [r.left, r.top, r.width, r.height].map(Math.round)));
      const obstaclesChanged = obstacleKey !== lastObstacles;
      const commit = (r: Rect) => {
        lastAnchor = anchor;
        lastSecondary = secondaryNext;
        lastObstacles = obstacleKey;
        setPosition((previous) => previous?.step === currentStep && previous.path === location.pathname && sameRect(previous.rect, r) && !anchorChanged && !secondaryChanged && !obstaclesChanged
          ? previous : { step: currentStep, path: location.pathname, rect: r, anchor, secondary: secondaryNext, obstacles, softObstacles, featureObstacles, bareObstacles });
        setViewport((previous) => previous.w === window.innerWidth && previous.h === window.innerHeight
          ? previous : { w: window.innerWidth, h: window.innerHeight });
        fallback = r.width === 0 && r.height === 0 && !next;
        setTargetUnavailable(fallback);
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
        // A pending route or Suspense/data skeleton is not a missing feature.
        // Start the feature-discovery budget only after the page has rendered.
        const pageLoading = !routeReady || Array.from(document.querySelectorAll('[data-trade-page-loading]'))
          .some((el) => (el as HTMLElement).offsetParent !== null);
        if (pageLoading) {
          if (!loadingSince) loadingSince = now;
          if (now - loadingSince < 30000) {
            missingSince = 0;
            frame = requestAnimationFrame(tick);
            return;
          }
        } else loadingSince = 0;
        // Never invent a spotlight for a missing feature. Offer explicit
        // retry/skip while retaining discovery if the real control loads later.
        if (!missingSince) missingSince = now;
        if (!ready && now - missingSince >= 8000) {
          commit({ top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 });
          setStepDone(false);
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
        if (!last || !sameRect(last, next) || anchorChanged || secondaryChanged || obstaclesChanged) { last = next; commit(next); }
      } else if (["collection", "quotes", "margin-protection"].includes(current.id)) {
        // Client View may reflow in the same paint: commit the validated
        // client price immediately instead of waiting for the stability timer.
        last = next;
        commit(next);
      } else if (!last || !sameRect(last, next)) {
        last = next;
        stableSince = now;
      } else if (now - stableSince >= 80) {
        // The galleries restore their own scroll after mounting; wait it out
        // so Step 3 never appears on the pre-scroll position first.
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
  }, [open, currentStep, location.pathname, stepRoute, stepTarget, targetRetry]);

  useLayoutEffect(() => {
    const sidebarRef = FELIX_STEP_SIDEBAR[step.id];
    if (open && !isPaused) {
      document.documentElement.dataset.felixTourStep = step.id;
      // Global step → sidebar map: styles.css pulses the matching nav item.
      if (sidebarRef && sidebarRef.where !== "header") document.documentElement.dataset.felixTourSidebar = sidebarRef.anchor;
      else delete document.documentElement.dataset.felixTourSidebar;
    } else {
      delete document.documentElement.dataset.felixTourStep;
      delete document.documentElement.dataset.felixTourSidebar;
    }
    return () => {
      delete document.documentElement.dataset.felixTourStep;
      delete document.documentElement.dataset.felixTourSidebar;
    };
  }, [open, isPaused, step.id]);

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
    const t = window.setTimeout(() => {
      if (!manualStartRef.current) setOpen(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [autoStart]);

  // External relaunch: window.dispatchEvent(new Event("felix-tour:start"))
  useEffect(() => {
    const onStart = () => {
      // An explicit Meet Felix/restart always begins at Welcome. Saved progress
      // is reserved for automatic continuation after an interrupted tour.
      manualStartRef.current = true;
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
      try { localStorage.removeItem(PROGRESS_KEY); } catch {}
      setTransitioning(false);
      setCurrentStep(0);
      setIsPaused(false);
      setOpen(true);
    };
    window.addEventListener("felix-tour:start", onStart);
    // A restart pressed while this component was momentarily unmounted (the
    // boundary can drop it while late chunks resolve) is picked up here.
    if (hasPendingTourStart()) onStart();
    return () => window.removeEventListener("felix-tour:start", onStart);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.felixTourActive = String(open);
    if (open) warmTourRoutes();
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
    // A finished tour lands the member back on the Trade User Dashboard —
    // the last step (Beta Feedboard) is the only step that leaves them on
    // another page, so completion always returns them home.
    if (completed && location.pathname !== "/trade") navigate("/trade", { replace: true });
    setIsPaused(false);
    setTransitioning(false);
    // Closing is an explicit skip; neither a completed nor skipped first tour
    // should keep greeting the member as new on the dashboard.
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
      // Remember where the member left off so the tour can resume there;
      // a finished tour clears any saved progress.
      if (completed) {
        localStorage.removeItem(PROGRESS_KEY);
        // The dashboard claims this marker once and confirms the landing.
        markTourCompleted();
      } else localStorage.setItem(PROGRESS_KEY, String(currentStep));
      clearTourStartRequest();
    } catch {}
  }, [currentStep, navigate, location.pathname]);

  const changeStep = (direction: number) => {
    if (transitioning) return;
    setTransitioning(true);
    transitionTimer.current = window.setTimeout(() => {
      setIsPaused(false);
      setCurrentStep((s) => Math.max(0, Math.min(s + direction, FELIX_STEPS.length - 1)));
      transitionTimer.current = null;
    }, reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 80);
  };
  const next = () => {
    if (!stepDone || !settled || transitioning) return;
    if (isLast) { setOpen(false); clearTourStartRequest(); setInitializing(true); return; }
    // The next frame (including route fallbacks) must already be client-safe.
    if (step.id === "client-safe-presentations") {
      setClientSafeMode(true);
      setCurrentStep(FELIX_STEPS.findIndex(s => s.id === "margin-protection"));
      return;
    }
    // Commit immediately; Studio Mode is restored only on the mounted Quotes
    // workspace, never on this outgoing product during pending navigation.
    if (step.id === "margin-protection") {
      setCurrentStep(FELIX_STEPS.findIndex(s => s.id === "quote-generation"));
      return;
    }
    changeStep(1);
  };
  const back = () => {
    changeStep(-1);
  };

  // Switching the board to client presentation is the action Step 15 asks
  // for, so it moves straight on to Step 16 instead of waiting for Next.
  const clientViewSawOff = useRef(false);
  useEffect(() => {
    if (step.id !== "client-view") { clientViewSawOff.current = false; return; }
    if (settled && !stepDone) { clientViewSawOff.current = true; return; }
    if (open && !isPaused && clientViewSawOff.current && stepDone && settled && !transitioning) {
      clientViewSawOff.current = false;
      next();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPaused, step.id, stepDone, settled, transitioning]);

  useEffect(() => {
    if (settled && transitioning && transitionTimer.current === null) setTransitioning(false);
  }, [settled, transitioning]);

  // Keyboard: Escape closes; ArrowRight/ArrowLeft move between steps.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(false); return; }
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, next, back]);

  // Move focus into the tooltip whenever the step changes so keyboard and
  // screen-reader users land on the new content.
  const cardRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!open || !card) return;
    const measureCard = () => setMeasuredCardHeight(card.getBoundingClientRect().height);
    measureCard();
    const observer = new ResizeObserver(measureCard);
    observer.observe(card);
    return () => observer.disconnect();
  }, [open, currentStep, settled, isPaused]);
  useEffect(() => {
    if (!open || isPaused) return;
    if (settled && !transitioning) cardRef.current?.focus({ preventScroll: true });
  }, [open, currentStep, settled, transitioning, isPaused]);

  if (initializing) return <StudioInitialization onSkip={() => { setInitializing(false); close(true); }} onComplete={projectId => {
    setInitializing(false);
    close(true);
    navigate(`/trade?project=${encodeURIComponent(projectId)}`, { replace: true });
  }} />;
  if (!open || typeof document === "undefined") return null;

  // No stale step or route geometry may be used while the new target mounts.
  const rect = position?.step === currentStep && position.path === location.pathname ? position.rect : null;
  const secondaryRect = rect && !targetUnavailable ? (position?.secondary ?? null) : null;
  const sidebarAnchor = rect && !targetUnavailable ? position?.anchor : null;
  // Card placement: right of the target, else left, below, or above.
  const cardW = Math.max(0, Math.min(step.id === "welcome" ? 410 : 380, viewport.w - 48));
  // Step 1 carries the tier breakdown and needs a taller placement box.
  const cardH = Math.min(measuredCardHeight || (step.id === "welcome" ? 545 : 380), Math.max(0, viewport.h - 32));
  const clampX = (x: number) => Math.min(Math.max(x, 24), Math.max(viewport.w - cardW - 24, 24));
  const clampY = (y: number) => Math.min(Math.max(y, 16), Math.max(viewport.h - cardH - 16, 16));
  let cardLeft = 0;
  let cardTop = 0;
  if (rect) {
    const centerY = clampY(rect.top + rect.height / 2 - cardH / 2);
    const centerX = clampX(rect.left + rect.width / 2 - cardW / 2);
    const rightX = rect.left + rect.width + PAD + 8;
    const leftX = rect.left - PAD - 8 - cardW;
    if (["collection", "quotes"].includes(step.id)) {
      const heading = document.querySelector('[data-felix-target="collection-overview"]')?.getBoundingClientRect();
      const origin = collectionTourCardOrigin(viewport.w, cardW, heading?.top ?? rect.top);
      cardLeft = origin.left;
      cardTop = origin.top;
    } else if (sidebarAnchor) {
      cardLeft = clampX(sidebarAnchor.left + sidebarAnchor.width + 24);
      cardTop = clampY(sidebarAnchor.top - 20);
    } else if (step.id === "client-view") {
      // Step 15: never below the switch (it would cover the product photo).
      // Right of the switch, offset so the action banner pinned at the top of
      // the card (~88px below the card edge) reads in line with the
      // highlighted toggle row; else above.
      if (rightX + cardW <= viewport.w - 16) {
        cardLeft = rightX;
        cardTop = clampY(rect.top + rect.height / 2 - 88);
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

  // Clamp every placement branch, leaving clearance for the arrow and shadow.
  cardLeft = clampX(cardLeft);
  cardTop = clampY(cardTop);
  const placementArgs = {
    viewport, width: cardW,
    height: cardRef.current?.firstElementChild?.scrollHeight ? cardRef.current.firstElementChild.scrollHeight + 2 : cardH,
    preferred: { left: cardLeft, top: cardTop },
  };
  // Tier 1 keeps the sidebar protected and lets a dimmed section heading be
  // uncovered when that is what lands the card beside its highlight; tier 2
  // only applies on short viewports where nothing fits without overlapping
  // navigation.
  const collectionPhotoTop = ["collection", "quotes"].includes(step.id)
    ? Array.from(document.querySelectorAll('[data-felix-collection-header] ~ div img'))
        .map(el => el.getBoundingClientRect()).filter(r => r.width > 100 && r.height > 100 && r.bottom > 0)
        .reduce((top, r) => Math.min(top, r.top), viewport.h - 16)
    : viewport.h - 16;
  const collectionPlacement = rect && ["collection", "quotes"].includes(step.id)
    ? collectionTourCardPlacement({ viewport, width: cardW, height: placementArgs.height, photoTop: collectionPhotoTop,
        headingRight: document.querySelector('[data-felix-target="collection-overview"]')?.getBoundingClientRect().right ?? 0 })
    : null;
  const placement = collectionPlacement ?? chooseTourCardPlacement({
    ...placementArgs,
    tiers: [
      [position?.obstacles ?? [], position?.featureObstacles ?? []],
      [position?.softObstacles ?? [], position?.bareObstacles ?? []],
    ],
  });
  // Last resort on short viewports where every free space is shallower than
  // the solver's floor: keep the tour operable with a floating bottom-right
  // card. A hidden card strands the member with no way to continue or skip.
  const effectivePlacement = placement ?? (rect ? {
    left: clampX(viewport.w - cardW - 24),
    top: clampY(viewport.h - Math.min(cardH, 420) - 16),
    width: cardW,
    height: Math.min(cardH, 420),
  } : null);
  if (effectivePlacement) { cardLeft = effectivePlacement.left; cardTop = effectivePlacement.top; }

  const ring = rect && !targetUnavailable && !isPaused && (
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

  // Orientation ring: outlines the secondary target (e.g. the top-right
  // Presentation Mode switch) without a dim cutout of its own. Painted after
  // the main ring so the dim layer never covers it.
  const secondaryRing = secondaryRect && !isPaused && (
    <div
      aria-hidden="true"
      data-felix-spotlight-secondary
      className="pointer-events-none fixed z-[131] rounded-md border-2 border-accent/80 motion-reduce:!transition-none"
      style={{
        top: 0,
        left: 0,
        transform: `translate3d(${secondaryRect.left - 6}px, ${secondaryRect.top - 6}px, 0)`,
        width: secondaryRect.width + 12,
        height: secondaryRect.height + 12,
        opacity: settled && !transitioning ? 1 : 0,
        transition: SPOTLIGHT_EASE,
        boxShadow: "0 0 18px hsl(var(--accent) / 0.45)",
      }}
    />
  );

  if (isPaused) return createPortal(
    <button
      type="button"
      onClick={() => setIsPaused(false)}
      className="fixed bottom-6 right-6 z-[132] inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-body text-[11px] uppercase tracking-widest text-foreground shadow-lg hover:bg-muted print:hidden"
      aria-label={`Resume ${guideName} tour`}
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
        {rect && settled && !transitioning && targetUnavailable && <div className="absolute inset-0 bg-foreground/40" />}
      </div>}
      {ring}
      {secondaryRing}
      {sidebarAnchor && step.id !== "quotes" && effectivePlacement && settled && !transitioning && (
        <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-[140] h-full w-full fill-none stroke-accent" strokeWidth="1.5">
          <path d={`M ${sidebarAnchor.left + sidebarAnchor.width + 8} ${sidebarAnchor.top + sidebarAnchor.height / 2} H ${Math.max(sidebarAnchor.left + sidebarAnchor.width + 12, cardLeft - 12)} V ${cardTop + 28} H ${Math.max(cardLeft, sidebarAnchor.left + sidebarAnchor.width + 12)}`} />
          <path data-felix-sidebar-arrow d={`M ${sidebarAnchor.left + sidebarAnchor.width + 13} ${sidebarAnchor.top + sidebarAnchor.height / 2 - 5} l -5 5 l 5 5`} />
        </svg>
      )}

      {/* The card is not mounted until this step's actual target is measured. */}
      {/* Screen-reader announcement for each step change */}
      <div aria-live="polite" role="status" className="sr-only">
        {`Step ${currentStep + 1} of ${FELIX_STEPS.length}: ${step.title}`}
      </div>

      {rect && <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        data-felix-tour-card
        tabIndex={-1}
        aria-label={`${guideName} — Your Curatorial Guide, step ${currentStep + 1} of ${FELIX_STEPS.length}: ${step.title}`}
        className={cn(
          "fixed z-[140] isolate print:hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        )}
        style={{ width: effectivePlacement?.width ?? cardW, left: 0, top: 0, transform: `translate3d(${cardLeft}px, ${cardTop}px, 0)`, visibility: settled && !transitioning && effectivePlacement ? "visible" : "hidden", pointerEvents: settled && !transitioning && effectivePlacement ? "auto" : "none" }}
      >
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl px-5 pt-5 pb-0" style={{ maxHeight: effectivePlacement ? effectivePlacement.height - 2 : viewport.h - 34 }}>
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
            {!isLast && <button
              onClick={() => close(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted -mr-1 -mt-1 shrink-0 outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close tour"
              title="Close tour"
            >
              <X className="h-4 w-4" />
            </button>}
          </div>

          {/* Required action — pinned to the top of the card so it reads in
              line with the highlighted control instead of floating below the
              dialogue. */}
          {(!stepDone || step.id === "collection" || step.id === "quotes") && !isPaused && !targetUnavailable && (
            <div role="status" className="mt-3 flex items-center gap-3 rounded-md bg-primary px-4 py-3 text-primary-foreground">
              <ArrowRight
                data-felix-control-arrow
                className="h-5 w-5 shrink-0"
                aria-hidden="true"
                style={{ transform: `rotate(${Math.atan2(rect.top + rect.height / 2 - (cardTop + 92), rect.left + rect.width / 2 - (cardLeft + 44)) * 180 / Math.PI}deg)` }}
              />
              <p className="font-body text-sm font-semibold leading-snug">
                {step.id === "collection" ? "Open The Collection to continue." : step.id === "quotes" ? "Click a different Collection tab." : step.id === "white-label" ? "Turn on ‘Use studio branding only’ below to unlock Next." : step.id === "client-view" ? "Switch to Client View to unlock Next." : "Use the highlighted control to continue."}
              </p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <label htmlFor="felix-reduced-motion" className="font-body text-xs text-muted-foreground">Reduce motion</label>
            <Switch id="felix-reduced-motion" aria-label="Reduce motion" checked={reducedMotion} disabled={systemReducedMotion} onCheckedChange={changeMotionPreference} title={systemReducedMotion ? "Enabled by your device preference" : "Reduce tour animation"} />
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
              {FELIX_STEPS.length - currentStep - 1 > 0 && (
                <span className="normal-case tracking-normal"> · {FELIX_STEPS.length - currentStep - 1} left</span>
              )}
            </span>
          </div>
          {/* Step dots — completed steps are clickable to jump back */}
          <div className="mt-2 flex items-center gap-1.5" role="group" aria-label="Tour progress">
            {FELIX_STEPS.map((s, i) => {
              const completed = i < currentStep;
              const active = i === currentStep;
              const jumpable = completed && !transitioning;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!jumpable}
                  onClick={() => jumpable && setCurrentStep(i)}
                  aria-label={completed ? `Go back to step ${i + 1}: ${s.title}` : `Step ${i + 1}: ${s.title}`}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
                    active ? "w-5 bg-accent" : completed ? "w-2 bg-accent/50 hover:bg-accent cursor-pointer" : "w-2 bg-muted-foreground/25 cursor-default",
                  )}
                />
              );
            })}
          </div>

          {/* Dialogue */}
          {targetUnavailable && (
            <div role="status" className="mt-4 space-y-3 border border-border bg-muted px-4 py-3">
              <p className="font-body text-sm">This feature is not available here yet. Retry, or skip this step without changing your workspace.</p>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => setTargetRetry((value) => value + 1)}>Retry</Button>
                <Button variant="outline" size="sm" onClick={() => isLast ? close(true) : changeStep(1)}>Skip step</Button>
              </div>
            </div>
          )}
          <div
            key={currentStep}
            className={cn(
              "mt-4 rounded-xl rounded-tl-sm bg-muted px-4 py-3 animate-fade-in",
              isPaused && "opacity-50",
            )}
          >
            <p className="font-body text-[13px] leading-relaxed text-foreground">{renderBold((step.id === "tier-tracking"
              ? step.dialogue
               : resolveTierTokens(step.dialogue, tiers, tierVolume))
              .replace(/\{goldPct\}/g, fmtPct(tiers.gold.discount_pct))
               .replace(/\{name\}/g, guideName)
               .replace(/\{projectTitle\}/g, projectTitle))}</p>
          </div>

          {/* Sidebar context: where this feature lives in the navigation tree */}
          {FELIX_STEP_SIDEBAR[step.id] && (
            <p data-felix-sidebar-ref className="mt-3 flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <PanelLeft className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              <span>
                {FELIX_STEP_SIDEBAR[step.id].where === "header"
                  ? "Find it later in the top-right of the header:"
                  : "Find it later in your sidebar:"}{" "}
                <span className="text-foreground">{FELIX_STEP_SIDEBAR[step.id].label}</span>
              </span>
            </p>
          )}

          {/* Trade tier structure — Step 1 only */}
          {step.id === "welcome" && (
            <div className="mt-4 animate-fade-in">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Trade Tier Structure
              </p>
              <div className="mt-2 divide-y divide-border border-y border-border">
                {([
                  { key: "silver" as TradeTier, note: "Base entry tier", current: true },
                  // Same regional milestones as Step 5: amounts convert the EUR-cent
                  // ledger through the fixed fiscal-year display ratio per market.
                  { key: "gold" as TradeTier, note: `Unlocks at ${tierVolume.format(tierVolume.amount(tiers.gold.min_spend_cents))} cumulative project volume`, current: false },
                  { key: "platinum" as TradeTier, note: `Unlocks at ${tierVolume.format(tierVolume.amount(tiers.platinum.min_spend_cents))} cumulative project volume`, current: false },
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
                Prices shown across The Collection — the Interactive Gallery and Designers & Ateliers — calculate automatically based on your active {fmtPct(tiers.silver.discount_pct)} discount level.
              </p>
            </div>
          )}

          {/* Spend examples — Step 5 (tier-tracking) only */}
          {step.id === "tier-tracking" && (
            <div className="mt-4 animate-fade-in">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                How Volume Progresses — Worked Example
              </p>
              <p className="mt-2 font-body text-[10px] leading-relaxed text-muted-foreground">
                Gold Tier — {tierVolume.format(tierVolume.gold)} cumulative spend · Platinum Tier — {tierVolume.format(tierVolume.platinum)} cumulative spend
              </p>
              <div className="mt-2 divide-y divide-border border-y border-border">
                {(() => {
                  const [p1, p2, p3] = tierVolume.examples;
                  const money = tierVolume.format;
                  return [
                    { project: "Three-room apartment, full curation", spend: money(p1), running: `Running total: ${money(p1)}` },
                    { project: projectExampleByCurrency[tierVolume.currency], spend: money(p2), running: `${money(p2)} — Gold unlocked single-handedly · Running total: ${money(p1 + p2)}` },
                    { project: tierVolume.currency === "SGD" ? "Sentosa Cove penthouse primary suites" : "Penthouse primary suites", spend: money(p3), running: `Running total: ${money(p1 + p2 + p3)} — Platinum unlocked` },
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
                    <p className="font-display text-[13px] text-foreground">Continued volume across studio portfolio</p>
                    <p className="mt-0.5 font-body text-[10px] leading-snug text-muted-foreground">
                      Running total: {tierVolume.format(tierVolume.platinum)}+ — Platinum privileges maintained
                    </p>
                  </div>
                  <p className="font-display text-[13px] font-semibold tracking-tight text-foreground whitespace-nowrap shrink-0">
                    {tierVolume.format(tierVolume.platinum)}+
                  </p>
                </div>
              </div>
              <p className="mt-3 font-body text-[10px] italic leading-relaxed text-muted-foreground">
                Every confirmed quote counts toward the same rolling 12-month total — a single {tierVolume.format(tierVolume.gold)} project reaches {tiers.gold.label} on its own.
              </p>
            </div>
          )}


          {isPaused && (
            <p className="mt-3 font-body text-[10px] uppercase tracking-[0.18em] text-accent">
              ● Paused — highlights hidden
            </p>
          )}

          {/* Controls */}
          <div className="sticky bottom-0 -mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-5 pb-5 pt-3">
            <button
              onClick={() => close(false)}
              className="font-body text-[11px] uppercase tracking-widest text-muted-foreground underline-offset-4 hover:text-foreground hover:underline rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            >
              Skip tour
            </button>
            <button
              onClick={back}
               disabled={currentStep === 0 || transitioning}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-body text-[11px] uppercase tracking-widest text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-body text-[11px] uppercase tracking-widest text-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              aria-pressed={isPaused}
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {isPaused ? "Resume" : "Pause"}
            </button>
            <Button variant="outline"
              onClick={next}
               disabled={!stepDone || !settled || transitioning}
              className="h-auto gap-1.5 rounded-none px-3.5 py-1.5 font-body text-[11px] uppercase"
            >
              {step.cta ?? (isLast ? "Finish" : "Next")}
              {isLast ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
            </Button>
            {isLast && <Button variant="link" onClick={() => close(true)} className="h-auto w-full p-0 pt-2 font-body text-[11px] text-muted-foreground">Skip to Dashboard</Button>}
          </div>
        </div>
      </div>}
    </>,
    document.getElementById("root") ?? document.body,
  );
}
