import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Routes, Route, useLocation, useNavigate, useNavigationType, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
// Index is the homepage and is loaded synchronously: lazy-loading it created
// a sequential chunk waterfall (main → Index → Hero) that delayed LCP on
// throttled mobile. Below-fold homepage sections stay lazy inside Index.
import Index from "./pages/Index";
import { CompareProvider } from "@/contexts/CompareContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { CheckoutFormProvider } from "@/contexts/CheckoutFormContext";
import { TradeCopilotProvider } from "@/contexts/TradeCopilotContext";
import { AuthProvider } from "@/hooks/useAuth";
import { StudioProvider } from "@/hooks/useStudio";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import { releaseDesignersLandingScrollLock } from "@/lib/designersScrollLock";
import { clearDarkIosChrome } from "@/lib/iosChrome";

// react-helmet-async is imported synchronously — wrapping the whole app in a
// lazy provider with Suspense fallback={null} blocked ALL React rendering on a
// separate chunk, which delayed every page's first paint.

// Lazy-load non-landing pages and non-critical UI
const TradeRoutes = lazy(() => import("./routes/TradeRoutes"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MobilePreviewShareButton = lazy(() => import("./components/MobilePreviewShareButton"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const DesignerUpload = lazy(() => import("./pages/DesignerUpload"));

function LegacyStephGcRedirect() {
  const { productSlug } = useParams();
  return <Navigate to={`/designers/steph-gc${productSlug ? `/${productSlug}` : ""}`} replace />;
}

// Trade portal pages
const TradeLogin = lazy(() => import("./pages/TradeLogin"));
const TradeLanding = lazy(() => import("./pages/TradeLanding"));
const TradeApply = lazy(() => import("./pages/TradeApply"));
const TradeProcessing = lazy(() => import("./pages/TradeProcessing"));
const TradeClientDashboard = lazy(() => import("./pages/TradeClientDashboard"));
const TradeOnboarding = lazy(() => import("./pages/TradeOnboarding"));
const TradeDemoPage = lazy(() => import("./pages/TradeDemoPage"));
const Studios = lazy(() => import("./pages/Studios"));
const StudioSubmit = lazy(() => import("./pages/StudioSubmit"));
const StudioProfile = lazy(() => import("./pages/StudioProfile"));
const StudioInsights = lazy(() => import("./pages/StudioInsights"));
const TradeRegister = lazy(() => import("./pages/TradeRegister"));
const CollectorSignup = lazy(() => import("./pages/CollectorSignup"));
const TradeApplicationEdit = lazy(() => import("./pages/TradeApplicationEdit"));
const TradeMobileLaunch = lazy(() => import("./pages/TradeMobileLaunch"));
const AdminTradeReview = lazy(() => import("./pages/AdminTradeReview"));
const PortalCN = lazy(() => import("./pages/PortalCN"));





const ClientBoardViewer = lazy(() => import("./pages/ClientBoardViewer"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NewIn = lazy(() => import("./pages/NewIn"));
const Journal = lazy(() => import("./pages/Journal"));
const JournalArticle = lazy(() => import("./pages/JournalArticle"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const DesignerProfile = lazy(() => import("./pages/DesignerProfile"));
const PublicDesigners = lazy(() => import("./pages/PublicDesigners"));
const PublicDesignerProfile = lazy(() => import("./pages/PublicDesignerProfile"));
const PublicDesignerBiography = lazy(() => import("./pages/PublicDesignerBiography"));
const PublicFavorites = lazy(() => import("./pages/PublicFavorites"));
const TradeSpecSheet = lazy(() => import("./pages/TradeSpecSheet"));
const ApartmentTour = lazy(() => import("./pages/ApartmentTour"));
const SpecSheetRedirect = lazy(() => import("./pages/SpecSheetRedirect"));
const PublicCollectibles = lazy(() => import("./pages/PublicCollectibles"));
const PublicGallery = lazy(() => import("./pages/PublicGallery"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const CartPage = lazy(() => import("./pages/Cart"));
const CartIdentifyPage = lazy(() => import("./pages/CartIdentify"));
const OrderConfirmationPage = lazy(() => import("./pages/OrderConfirmation"));
const SuccessPage = lazy(() => import("./pages/Success"));
const CheckoutPage = lazy(() => import("./pages/Checkout"));
const BankWireInstructionsPage = lazy(() => import("./pages/BankWireInstructions"));
const ConciergePage = lazy(() => import("./pages/ConciergePage"));
const ProductPageContainer = lazy(() => import("./pages/ProductPageContainer"));
const CategoryRoute = lazy(() => import("./pages/CategoryRoute"));
const ScreenshotGallery = lazy(() => import("./pages/ScreenshotGallery"));
const CuratorsPicksDemo = lazy(() => import("./pages/CuratorsPicksDemo"));



// Defer heavy providers + toast UI — not needed for hero/LCP
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));
const CookieConsent = lazy(() => import("@/components/CookieConsent"));

// Set to false to disable maintenance mode and show the real site
const MAINTENANCE_MODE = false;

const PageTracker = lazy(() => import("./hooks/usePageTracking").then(m => {
  const Tracker = () => { m.default(); return null; };
  return { default: Tracker };
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      // Reuse cached data across `/`, `/designers`, category pages, etc.
      // Individual hooks can still override with a longer staleTime.
      staleTime: 5 * 60_000, // 5 min — data is considered fresh
      gcTime: 30 * 60_000, // 30 min — kept in memory after unmount
      retry: 1,
    },
  },
});

const PREVIEW_VIEW_STATE_KEY = "ma:preview-view-state";
let previewLocationRestored = false;

function getPreviewAnchorId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const probeY = Math.min(Math.max(window.innerHeight * 0.35, 120), window.innerHeight - 80);
  const elements = document.elementsFromPoint(window.innerWidth / 2, probeY);

  for (const element of elements) {
    const anchored = element.closest<HTMLElement>("section[id], main[id], article[id], [data-preview-anchor][id]");
    if (anchored?.id && anchored.id !== "main-content") return anchored.id;
  }

  const sections = Array.from(document.querySelectorAll<HTMLElement>("section[id], article[id], [data-preview-anchor][id]"));
  return sections
    .map((el) => ({ id: el.id, distance: Math.abs(el.getBoundingClientRect().top - probeY) }))
    .sort((a, b) => a.distance - b.distance)[0]?.id;
}

function isPreviewOrDev(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;

  const host = window.location.hostname;
  const isLovablePreview =
    host.includes("lovableproject.com") ||
    host.includes("id-preview--");

  let isFramed = false;
  try {
    isFramed = window.self !== window.top;
  } catch {
    isFramed = true;
  }

  return isLovablePreview || isFramed;
}

// Sync a `data-home` attribute on <body> with the current route for route-level CSS hooks.
function HomeRouteSync() {
  const location = useLocation();
  useEffect(() => {
    const isHome = location.pathname === "/" || location.pathname === "";
    const staticHero = document.getElementById("static-hero");
    const staticHeroCopy = document.getElementById("static-hero-copy");
    const staticDesignersHero = document.getElementById("static-designers-hero");
    const staticDesignersOverlay = document.getElementById("static-designers-hero-overlay");

    if (isHome) {
      document.body.setAttribute("data-home", "");
      staticHero?.style.setProperty("display", "block", "important");
      staticHeroCopy?.style.setProperty("display", "none", "important");
      staticDesignersHero?.style.setProperty("display", "none", "important");
      staticDesignersOverlay?.style.setProperty("display", "none", "important");
      document.documentElement.style.removeProperty("background-image");
      document.documentElement.style.removeProperty("background-size");
      document.documentElement.style.removeProperty("background-position");
      document.documentElement.style.removeProperty("background-repeat");
      document.body.style.removeProperty("background-image");
      document.body.style.removeProperty("background-size");
      document.body.style.removeProperty("background-position");
      document.body.style.removeProperty("background-repeat");
    } else {
      document.body.removeAttribute("data-home");
      staticHero?.style.setProperty("display", "none", "important");
      staticHeroCopy?.style.setProperty("display", "none", "important");
    }
  }, [location.pathname]);
  return null;
}

// Scroll to top on PUSH/REPLACE navigations. Smooth is now the default so it
// triggers for every Link/navigate() call regardless of source (menu, logo,
// footer, deep link, programmatic, fast/duplicate clicks). Skips when:
//   - navigation is POP (back/forward) — browser restores prior scroll
//   - URL has a hash — anchor scrolling handles itself
//   - location.state.preserveScroll is set explicitly
//   - location.state.smoothScroll === false (opt-out for instant jumps)
//   - prefers-reduced-motion is enabled
function ScrollToTopOnNavigate() {
  const location = useLocation();
  const navType = useNavigationType();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = location.pathname;
    // Same-route query updates are in-page filters; keep the user at the
    // directory instead of jumping back to the route hero.
    if (prevPath === location.pathname) return;
    if (navType === "POP") return;
    if (location.hash) return;
    const state = location.state as { preserveScroll?: boolean; smoothScroll?: boolean } | null;
    if (state?.preserveScroll) return;
    const isLockedDesignersLanding =
      location.pathname === "/designers" &&
      !location.search &&
      (window.matchMedia?.("(max-width: 767px)").matches ||
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true);
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const smooth = !isLockedDesignersLanding && state?.smoothScroll !== false && !prefersReduced;
    const behavior: ScrollBehavior = smooth ? "smooth" : "instant";
    // Defer one frame so the new route mounts before we animate — prevents the
    // browser from snapping mid-transition when React commits the new tree.
    const raf = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname, location.hash, location.state, navType]);

  return null;
}

function RouteScrollLockFailsafe() {
  const location = useLocation();

  useLayoutEffect(() => {
    if (location.pathname !== "/designers") releaseDesignersLandingScrollLock();
    // Dark iOS chrome is opt-in for the hero + designers landing only. Any
    // other route must clear it, otherwise a leftover black canvas shows
    // behind the iOS toolbar (e.g. deep-linking into a designer profile from
    // a dark route whose unmount cleanup never ran).
    if (
      location.pathname !== "/" &&
      location.pathname !== "/designers" &&
      location.pathname !== "/trade-program"
    ) {
      clearDarkIosChrome();
    }
  }, [location.pathname]);

  return null;
}


function PreviewViewContinuity() {
  const location = useLocation();
  const anchorIdRef = useRef<string | undefined>(undefined);

  const isLockedDesignersLanding = location.pathname === "/designers" && !location.search;


  useEffect(() => {
    if (!isPreviewOrDev()) return;

    let timer: number | null = null;
    const save = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          anchorIdRef.current = getPreviewAnchorId() || anchorIdRef.current;
          localStorage.setItem(
            PREVIEW_VIEW_STATE_KEY,
            JSON.stringify({
              path: location.pathname,
              search: location.search,
              scrollY: window.scrollY,
              anchorId: anchorIdRef.current,
              ts: Date.now(),
            }),
          );
        } catch {
          /* noop */
        }
      }, 120);
    };

    save();
    const updateAnchor = () => {
      anchorIdRef.current = getPreviewAnchorId() || anchorIdRef.current;
      save();
    };
    const restoreAnchorAfterResize = () => {
      if (isLockedDesignersLanding) return;
      const anchorId = anchorIdRef.current;
      if (!anchorId) return;
      window.setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
      }, 80);
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("scrollend", updateAnchor);
    window.addEventListener("resize", restoreAnchorAfterResize);
    window.addEventListener("pagehide", save);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("scroll", save);
      window.removeEventListener("scrollend", updateAnchor);
      window.removeEventListener("resize", restoreAnchorAfterResize);
      window.removeEventListener("pagehide", save);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isPreviewOrDev()) return;
    if (isLockedDesignersLanding) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      try { localStorage.removeItem(PREVIEW_VIEW_STATE_KEY); } catch { /* noop */ }
      return;
    }
    try {
      const raw = localStorage.getItem(PREVIEW_VIEW_STATE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { path?: string; search?: string; scrollY?: number };
      if (saved.path !== location.pathname || (saved.search || "") !== location.search) return;
      if (!saved.scrollY || saved.scrollY <= 0) return;

      let attempts = 0;
      const restore = () => {
        if (document.documentElement.scrollHeight >= saved.scrollY! + window.innerHeight * 0.5 || attempts >= 20) {
          window.scrollTo({ top: saved.scrollY, behavior: "instant" as ScrollBehavior });
          return;
        }
        attempts += 1;
        window.setTimeout(restore, 150);
      };
      window.setTimeout(restore, 80);
    } catch {
      /* noop */
    }
  }, [location.pathname, location.search]);

  return null;
}

function restorePreviewLocationBeforeRouter() {
  if (previewLocationRestored || !isPreviewOrDev() || typeof window === "undefined") return;
  previewLocationRestored = true;

  try {
    const raw = localStorage.getItem(PREVIEW_VIEW_STATE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { path?: string; search?: string; ts?: number };
    const isFresh = typeof saved.ts === "number" && Date.now() - saved.ts < 30 * 60 * 1000;
    const currentSearch = new URLSearchParams(window.location.search);
    currentSearch.delete("__lovable_token");
    const currentIsRoot = window.location.pathname === "/" && !currentSearch.toString() && !window.location.hash;
    const savedPath = saved.path || "/";

    if (isFresh && currentIsRoot && savedPath !== "/") {
      const token = new URLSearchParams(window.location.search).get("__lovable_token");
      const nextSearch = new URLSearchParams(saved.search || "");
      if (token) nextSearch.set("__lovable_token", token);
      const search = nextSearch.toString();
      window.history.replaceState(null, "", `${savedPath}${search ? `?${search}` : ""}`);
    }
  } catch {
    /* noop */
  }
}

function SameOriginLinkGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;

      event.preventDefault();
      const navStateRaw = anchor.getAttribute("data-nav-state");
      const navState = navStateRaw ? (() => {
        try { return JSON.parse(navStateRaw); } catch { return undefined; }
      })() : undefined;
      navigate(next, navState !== undefined ? { state: navState } : undefined);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate]);

  return null;
}

const App = () => {
  restorePreviewLocationBeforeRouter();
  const [showDeferredUi, setShowDeferredUi] = useState(false);

  // Block Pinterest browser extension globally.
  // Deferred to idle and rAF-batched: running full-document querySelectorAll on
  // every mutation during mount was one of the long startup tasks on mobile.
  useEffect(() => {
    const win = window as any;
    let observer: MutationObserver | null = null;
    let scheduled = false;
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const blockPinterest = () => {
      scheduled = false;
      document.querySelectorAll('[data-pin-log], [class*="PinIt"], [class*="pinterest"]').forEach(el => el.remove());
      document.querySelectorAll('img:not([data-pin-nopin])').forEach(img => {
        img.setAttribute('data-pin-nopin', 'true');
      });
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(blockPinterest);
    };

    const start = () => {
      blockPinterest();
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(start, { timeout: 3000 });
    } else {
      timeoutId = window.setTimeout(start, 1500);
    }

    return () => {
      if (idleId !== null) win.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const normalizedPath = pathname.replace(/\/\/{2,}/g, "/");

    if (normalizedPath !== pathname) {
      window.history.replaceState(null, "", `${normalizedPath}${search}${hash}`);
    }
  }, []);

  useEffect(() => {
    const win = window as any;
    const isHome = window.location.pathname === "/" || window.location.pathname === "";

    if (isHome) {
      let idleId: number | null = null;
      let timeoutId: number | null = null;
      let loadFallbackId: number | null = null;
      let started = false;

      const start = () => {
        if (started) return;
        started = true;
        timeoutId = window.setTimeout(() => {
          if (typeof win.requestIdleCallback === "function") {
            idleId = win.requestIdleCallback(() => setShowDeferredUi(true), { timeout: 3000 });
          } else {
            setShowDeferredUi(true);
          }
        }, 12000);
      };

      if (document.readyState === "complete") {
        start();
      } else {
        window.addEventListener("load", start, { once: true });
        loadFallbackId = window.setTimeout(start, 12000);
      }

      return () => {
        window.removeEventListener("load", start);
        if (timeoutId) window.clearTimeout(timeoutId);
        if (loadFallbackId) window.clearTimeout(loadFallbackId);
        if (idleId !== null) win.cancelIdleCallback?.(idleId);
      };
    }

    if (typeof win.requestIdleCallback === "function") {
      const idleId = win.requestIdleCallback(() => setShowDeferredUi(true), { timeout: 1500 });
      return () => win.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(() => setShowDeferredUi(true), 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <Suspense fallback={null}>
      <HelmetProvider>
        <AuthProvider>
        <StudioProvider>
        <CompareProvider>
        <WishlistProvider>
        <CheckoutFormProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <HomeRouteSync />
              <SameOriginLinkGuard />
              <RouteScrollLockFailsafe />
              <ScrollToTopOnNavigate />
              <PreviewViewContinuity />


              {MAINTENANCE_MODE ? (
                <Routes>
                  <Route path="*" element={<Suspense fallback={null}><ComingSoon /></Suspense>} />
                </Routes>
              ) : (
                <TradeCopilotProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/products-category/:categorySlug" element={<Suspense fallback={<PageLoadingSkeleton />}><CategoryRoute /></Suspense>} />
                  <Route path="/products-category/:categorySlug/:subcategorySlug" element={<Suspense fallback={<PageLoadingSkeleton />}><CategoryRoute /></Suspense>} />

                  {/* Trade Portal */}
                  <Route path="/trade/login" element={<Suspense fallback={null}><TradeLogin /></Suspense>} />
                  <Route path="/trade-program" element={<Suspense fallback={null}><TradeLanding /></Suspense>} />
                  <Route path="/trade/apply" element={<Suspense fallback={null}><TradeApply /></Suspense>} />
                  <Route path="/trade/processing" element={<Suspense fallback={null}><TradeProcessing /></Suspense>} />
                  <Route path="/trade-dashboard" element={<Suspense fallback={null}><TradeClientDashboard /></Suspense>} />
                  <Route path="/trade-onboarding" element={<Suspense fallback={null}><TradeOnboarding /></Suspense>} />
                  <Route path="/trade-demo" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeDemoPage /></Suspense>} />
                  <Route path="/trade/register" element={<Suspense fallback={null}><TradeRegister /></Suspense>} />
                  <Route path="/collector-signup" element={<Suspense fallback={null}><CollectorSignup /></Suspense>} />
                  <Route path="/cn" element={<Suspense fallback={null}><PortalCN /></Suspense>} />
                  <Route path="/trade/apply/complete/:token" element={<Suspense fallback={null}><TradeApplicationEdit /></Suspense>} />
                  <Route path="/reset-password" element={<Suspense fallback={null}><ResetPassword /></Suspense>} />
                  <Route path="/product/:id" element={<Suspense fallback={<PageLoadingSkeleton />}><ProductPage /></Suspense>} />
                  <Route path="/designer/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><DesignerProfile /></Suspense>} />
                  {/* Public designers directory — hidden from nav until all data is populated */}
                  <Route path="/designers" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicDesigners /></Suspense>} />
                  <Route path="/designers/stephane-cg" element={<LegacyStephGcRedirect />} />
                  <Route path="/designers/stephane-cg/:productSlug" element={<LegacyStephGcRedirect />} />
                  <Route path="/designers/:slug/biography" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicDesignerBiography /></Suspense>} />
                  <Route path="/designers/:slug/:productSlug" element={<Suspense fallback={<PageLoadingSkeleton />}><ProductPageContainer isInsideTradePortal={false} /></Suspense>} />

                  <Route path="/designers/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicDesignerProfile /></Suspense>} />
                  <Route path="/favorites" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicFavorites /></Suspense>} />
                  <Route path="/collectibles" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicCollectibles /></Suspense>} />
                  <Route path="/gallery" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicGallery /></Suspense>} />
                  <Route path="/designers-hero-lock" element={<Suspense fallback={<PageLoadingSkeleton />}><ScreenshotGallery /></Suspense>} />
                  <Route path="/curators-picks-demo" element={<Suspense fallback={<PageLoadingSkeleton />}><CuratorsPicksDemo /></Suspense>} />
                  <Route path="/contact" element={<Suspense fallback={<PageLoadingSkeleton />}><ContactPage /></Suspense>} />
                  <Route path="/cart" element={<Suspense fallback={<PageLoadingSkeleton />}><CartPage /></Suspense>} />
                  <Route path="/cart/identify" element={<Suspense fallback={<PageLoadingSkeleton />}><CartIdentifyPage /></Suspense>} />
                  <Route path="/order-confirmation" element={<Suspense fallback={<PageLoadingSkeleton />}><OrderConfirmationPage /></Suspense>} />
                  <Route path="/success" element={<Suspense fallback={<PageLoadingSkeleton />}><SuccessPage /></Suspense>} />
                  <Route path="/checkout" element={<Suspense fallback={<PageLoadingSkeleton />}><CheckoutPage /></Suspense>} />
                  <Route path="/bank-wire-instructions" element={<Suspense fallback={<PageLoadingSkeleton />}><BankWireInstructionsPage /></Suspense>} />
                  <Route path="/concierge" element={<Suspense fallback={<PageLoadingSkeleton />}><ConciergePage /></Suspense>} />
                   <Route path="/apartment-tour" element={<Suspense fallback={<PageLoadingSkeleton />}><ApartmentTour /></Suspense>} />
                  <Route path="/studios" element={<Suspense fallback={<PageLoadingSkeleton />}><Studios /></Suspense>} />
                  <Route path="/studios/submit" element={<Suspense fallback={<PageLoadingSkeleton />}><StudioSubmit /></Suspense>} />
                  <Route path="/studios/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><StudioProfile /></Suspense>} />
                  <Route path="/studios/:slug/insights" element={<Suspense fallback={<PageLoadingSkeleton />}><StudioInsights /></Suspense>} />
                  
                  
                  <Route path="/board/:token" element={<Suspense fallback={<PageLoadingSkeleton />}><ClientBoardViewer /></Suspense>} />
                  <Route path="/new-in" element={<Suspense fallback={<PageLoadingSkeleton />}><NewIn /></Suspense>} />
                  <Route path="/designer-upload/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><DesignerUpload /></Suspense>} />

                  <Route path="/journal" element={<Suspense fallback={<PageLoadingSkeleton />}><Journal /></Suspense>} />
                  <Route path="/journal/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><JournalArticle /></Suspense>} />
                  <Route path="/spec-sheets/:slug" element={<Suspense fallback={null}><SpecSheetRedirect /></Suspense>} />
                  <Route path="/trade/spec-sheet" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeSpecSheet /></Suspense>} />
                  <Route path="/trade/launch" element={<Suspense fallback={null}><TradeMobileLaunch /></Suspense>} />
                  <Route path="/trade/mobile-launch" element={<Suspense fallback={null}><TradeMobileLaunch /></Suspense>} />
                  <Route path="/admin/trade-review" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminTradeReview /></Suspense>} />
                  <Route path="/trade/*" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeRoutes /></Suspense>} />

                  <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPolicy /></Suspense>} />
                  <Route path="/terms" element={<Suspense fallback={null}><TermsOfService /></Suspense>} />
                  <Route path="/unsubscribe" element={<Suspense fallback={null}><Unsubscribe /></Suspense>} />
                  <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
                </Routes>
                </TradeCopilotProvider>
              )}

              {/* Deferred UI: toasts + analytics mount after hero is painted */}
              {showDeferredUi && (
                <Suspense fallback={null}>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <PageTracker />
                    <CookieConsent />
                  </TooltipProvider>
                </Suspense>
              )}
              {/* DevDuplicateBannerHost moved to /trade/admin/duplicates page */}
              {showDeferredUi && (
                <Suspense fallback={null}>
                  <MobilePreviewShareButton />
                </Suspense>
              )}
            </BrowserRouter>
          </QueryClientProvider>
        </CheckoutFormProvider>
        </WishlistProvider>
        </CompareProvider>
        </StudioProvider>
        </AuthProvider>
      </HelmetProvider>
    </Suspense>
  );
};

export default App;
