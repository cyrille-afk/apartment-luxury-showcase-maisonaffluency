import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "./pages/Index";
import TradeAxonometric from "./pages/TradeAxonometric";
import { CompareProvider } from "@/contexts/CompareContext";
import { AuthProvider } from "@/hooks/useAuth";
import { StudioProvider } from "@/hooks/useStudio";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";

// Defer react-helmet-async — all critical meta tags are already in index.html
const LazyHelmetProvider = lazy(() =>
  import("react-helmet-async").then(m => ({ default: m.HelmetProvider }))
);

// Lazy-load non-landing pages and non-critical UI
const NotFound = lazy(() => import("./pages/NotFound"));
const MobilePreviewShareButton = lazy(() => import("./components/MobilePreviewShareButton"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));

// Trade portal pages
const TradeLogin = lazy(() => import("./pages/TradeLogin"));
const TradeLanding = lazy(() => import("./pages/TradeLanding"));
const Studios = lazy(() => import("./pages/Studios"));
const StudioSubmit = lazy(() => import("./pages/StudioSubmit"));
const StudioProfile = lazy(() => import("./pages/StudioProfile"));
const StudioInsights = lazy(() => import("./pages/StudioInsights"));
const TradeRegister = lazy(() => import("./pages/TradeRegister"));
const TradeLayout = lazy(() => import("./pages/TradeLayout"));
const TradeGuides = lazy(() => import("./pages/TradeGuides"));
const TradeGuideDetail = lazy(() => import("./pages/TradeGuideDetail"));
const TradeGuidesAnalytics = lazy(() => import("./pages/TradeGuidesAnalytics"));
const TradeErrorBoundary = lazy(() => import("./components/trade/TradeErrorBoundary"));
const TradeDashboard = lazy(() => import("./pages/TradeDashboard"));
const TradeAdmin = lazy(() => import("./pages/TradeAdmin"));
const TradeAdminDashboard = lazy(() => import("./pages/TradeAdminDashboard"));
const TradeConciergeUsage = lazy(() => import("./pages/TradeConciergeUsage"));
const TradeAiUsageDashboard = lazy(() => import("./pages/TradeAiUsageDashboard"));
const TradeRagDebug = lazy(() => import("./pages/TradeRagDebug"));
const TradeAiUsagePrintCheck = lazy(() => import("./pages/TradeAiUsagePrintCheck"));

const TradeDescriptionWriter = lazy(() => import("./pages/TradeDescriptionWriter"));
const TradeRegisteredUsers = lazy(() => import("./pages/TradeRegisteredUsers"));
const TradeGallery = lazy(() => import("./pages/TradeGallery"));
const TradeDocuments = lazy(() => import("./pages/TradeDocuments"));
const TradeDownloadsByCountry = lazy(() => import("./pages/TradeDownloadsByCountry"));
const TradeMagazineAnalytics = lazy(() => import("./pages/TradeMagazineAnalytics"));
const TradeQuotes = lazy(() => import("./pages/TradeQuotes"));
const TradeQuoteReview = lazy(() => import("./pages/TradeQuoteReview"));
const TradeSettings = lazy(() => import("./pages/TradeSettings"));
const TradeStudioSettings = lazy(() => import("./pages/TradeStudioSettings"));
const TradeOrderTimeline = lazy(() => import("./pages/TradeOrderTimeline"));
const TradeFFESchedule = lazy(() => import("./pages/TradeFFESchedule"));
const TradeFFEExportTest = lazy(() => import("./pages/TradeFFEExportTest"));
const TradeMaterialLibrary = lazy(() => import("./pages/TradeMaterialLibrary"));
const TradeTearsheets = lazy(() => import("./pages/TradeTearsheets"));
const TradeAnnotations = lazy(() => import("./pages/TradeAnnotations"));
const TradeShippingTracker = lazy(() => import("./pages/TradeShippingTracker"));
const TradeShippingEstimator = lazy(() => import("./pages/TradeShippingEstimator"));
const TradeAdminShippingRates = lazy(() => import("./pages/TradeAdminShippingRates"));
const TradeAdminShippingSurcharges = lazy(() => import("./pages/TradeAdminShippingSurcharges"));
const TradeAdminTaxonomyAudit = lazy(() => import("./pages/TradeAdminTaxonomyAudit"));
const TradeAdminSyncStatus = lazy(() => import("./pages/TradeAdminSyncStatus"));
const TradeAdminBrandLeadTimes = lazy(() => import("./pages/TradeAdminBrandLeadTimes"));
const TradeAdminTiers = lazy(() => import("./pages/TradeAdminTiers"));
const TradeAdminCadAssets = lazy(() => import("./pages/TradeAdminCadAssets"));
const TradeAdminGlbModels = lazy(() => import("./pages/TradeAdminGlbModels"));
const TradeAdminOgPipeline = lazy(() => import("./pages/TradeAdminOgPipeline"));
const TradeAdminOnboarding = lazy(() => import("./pages/TradeAdminOnboarding"));
const TradeAdminOnboardingFunnel = lazy(() => import("./pages/TradeAdminOnboardingFunnel"));

const TradeAdminSharePreview = lazy(() => import("./pages/TradeAdminSharePreview"));
const TradeMoodBoards = lazy(() => import("./pages/TradeMoodBoards"));
const TradeBudgetTracker = lazy(() => import("./pages/TradeBudgetTracker"));
const TradeClients = lazy(() => import("./pages/TradeClients"));
const TradeLeadTimeCalendar = lazy(() => import("./pages/TradeLeadTimeCalendar"));
const TradeReorder = lazy(() => import("./pages/TradeReorder"));
const TradeCurrencyConverter = lazy(() => import("./pages/TradeCurrencyConverter"));
const TradeCPD = lazy(() => import("./pages/TradeCPD"));
const TradeComparator = lazy(() => import("./pages/TradeComparator"));
const TradeTools = lazy(() => import("./pages/TradeTools"));
const TradeFloorPlanFFE = lazy(() => import("./pages/TradeFloorPlanFFE"));
const TradeShowroom = lazy(() => import("./pages/TradeShowroom"));
const TradeSamples = lazy(() => import("./pages/TradeSamples"));
const TradeJournal = lazy(() => import("./pages/TradeJournal"));
const TradeProvenance = lazy(() => import("./pages/TradeProvenance"));
const TradeDocumentsAdmin = lazy(() => import("./pages/TradeDocumentsAdmin"));
const TradeMediaLibrary = lazy(() => import("./pages/TradeMediaLibrary"));
const TradeQuotesAdmin = lazy(() => import("./pages/TradeQuotesAdmin"));
const TradeAxonometricRequests = lazy(() => import("./pages/TradeAxonometricRequests"));
const TradeCustomRequests = lazy(() => import("./pages/TradeCustomRequests"));
const TradeFairCalendar = lazy(() => import("./pages/TradeFairCalendar"));
const TradeAxonometricGallery = lazy(() => import("./pages/TradeAxonometricGallery"));
const TradePresentations = lazy(() => import("./pages/TradePresentations"));
const TradePresentationBuilder = lazy(() => import("./pages/TradePresentationBuilder"));
const TradePresentationViewer = lazy(() => import("./pages/TradePresentationViewer"));
const TradeFavorites = lazy(() => import("./pages/TradeFavorites"));
const TradeMyDashboard = lazy(() => import("./pages/TradeMyDashboard"));
const TradeFavoriteFolderDetail = lazy(() => import("./pages/TradeFavoriteFolderDetail"));
const TradeFfeTool = lazy(() => import("./pages/TradeFfeTool"));
const TradeSpatialFit = lazy(() => import("./pages/TradeSpatialFit"));
const TradeSpatialFitAudit = lazy(() => import("./pages/TradeSpatialFitAudit"));
const TradeBoards = lazy(() => import("./pages/TradeBoards"));
const TradeBoardBuilder = lazy(() => import("./pages/TradeBoardBuilder"));
const TradeProjects = lazy(() => import("./pages/TradeProjects"));
const TradeProjectDetail = lazy(() => import("./pages/TradeProjectDetail"));
const ClientBoardViewer = lazy(() => import("./pages/ClientBoardViewer"));
const TradeInsights = lazy(() => import("./pages/TradeInsights"));
const TradeDesigners = lazy(() => import("./pages/TradeDesigners"));
const TradeDesignersAdmin = lazy(() => import("./pages/TradeDesignersAdmin"));
const TradeAdminProductAudit = lazy(() => import("./pages/TradeAdminProductAudit"));
const TradeInstagramAudit = lazy(() => import("./pages/TradeInstagramAudit"));
const TradeAuditLog = lazy(() => import("./pages/TradeAuditLog"));
const TradeClientProfiles = lazy(() => import("./pages/TradeClientProfiles"));
const TradeAtelierProfile = lazy(() => import("./pages/TradeAtelierProfile"));
const TradeProductPage = lazy(() => import("./pages/TradeProductPage"));
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
const PublicFavorites = lazy(() => import("./pages/PublicFavorites"));
const TradeSpecSheet = lazy(() => import("./pages/TradeSpecSheet"));
const ApartmentTour = lazy(() => import("./pages/ApartmentTour"));
const SpecSheetRedirect = lazy(() => import("./pages/SpecSheetRedirect"));
const PublicCollectibles = lazy(() => import("./pages/PublicCollectibles"));
const PublicGallery = lazy(() => import("./pages/PublicGallery"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const ConciergePage = lazy(() => import("./pages/ConciergePage"));
const PublicProductPage = lazy(() => import("./pages/PublicProductPage"));
const CategoryRoute = lazy(() => import("./pages/CategoryRoute"));


// Defer heavy providers + toast UI — not needed for hero/LCP
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));
const TradeAdminDuplicates = lazy(() => import("./pages/TradeAdminDuplicates"));
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

function PreviewViewContinuity() {
  const location = useLocation();
  const anchorIdRef = useRef<string | undefined>(undefined);

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

const App = () => {
  restorePreviewLocationBeforeRouter();
  const [showDeferredUi, setShowDeferredUi] = useState(false);

  // Block Pinterest browser extension globally
  useEffect(() => {
    const blockPinterest = () => {
      // Remove any Pinterest-injected elements
      document.querySelectorAll('[data-pin-log], [class*="PinIt"], [class*="pinterest"]').forEach(el => el.remove());
      // Mark ALL images as non-pinnable so the extension never shows hover buttons
      document.querySelectorAll('img:not([data-pin-nopin])').forEach(img => {
        img.setAttribute('data-pin-nopin', 'true');
      });
    };
    blockPinterest();
    const observer = new MutationObserver(blockPinterest);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
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

    if (typeof win.requestIdleCallback === "function") {
      const idleId = win.requestIdleCallback(() => setShowDeferredUi(true), { timeout: 1500 });
      return () => win.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(() => setShowDeferredUi(true), 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <Suspense fallback={null}>
      <LazyHelmetProvider>
        <AuthProvider>
        <StudioProvider>
        <CompareProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <PreviewViewContinuity />
              {MAINTENANCE_MODE ? (
                <Routes>
                  <Route path="*" element={<Suspense fallback={null}><ComingSoon /></Suspense>} />
                </Routes>
              ) : (
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/products-category/:categorySlug" element={<Suspense fallback={<PageLoadingSkeleton />}><CategoryRoute /></Suspense>} />
                  <Route path="/products-category/:categorySlug/:subcategorySlug" element={<Suspense fallback={<PageLoadingSkeleton />}><CategoryRoute /></Suspense>} />

                  {/* Trade Portal */}
                  <Route path="/trade/login" element={<Suspense fallback={null}><TradeLogin /></Suspense>} />
                  <Route path="/trade-program" element={<Suspense fallback={null}><TradeLanding /></Suspense>} />
                  <Route path="/trade/register" element={<Suspense fallback={null}><TradeRegister /></Suspense>} />
                  <Route path="/reset-password" element={<Suspense fallback={null}><ResetPassword /></Suspense>} />
                  <Route path="/product/:id" element={<Suspense fallback={<PageLoadingSkeleton />}><ProductPage /></Suspense>} />
                  <Route path="/designer/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><DesignerProfile /></Suspense>} />
                  {/* Public designers directory — hidden from nav until all data is populated */}
                  <Route path="/designers" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicDesigners /></Suspense>} />
                  <Route path="/designers/:slug/:productSlug" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicProductPage /></Suspense>} />
                  <Route path="/designers/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicDesignerProfile /></Suspense>} />
                  <Route path="/favorites" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicFavorites /></Suspense>} />
                  <Route path="/collectibles" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicCollectibles /></Suspense>} />
                  <Route path="/gallery" element={<Suspense fallback={<PageLoadingSkeleton />}><PublicGallery /></Suspense>} />
                  <Route path="/contact" element={<Suspense fallback={<PageLoadingSkeleton />}><ContactPage /></Suspense>} />
                  <Route path="/concierge" element={<Suspense fallback={<PageLoadingSkeleton />}><ConciergePage /></Suspense>} />
                   <Route path="/apartment-tour" element={<Suspense fallback={<PageLoadingSkeleton />}><ApartmentTour /></Suspense>} />
                  <Route path="/studios" element={<Suspense fallback={<PageLoadingSkeleton />}><Studios /></Suspense>} />
                  <Route path="/studios/submit" element={<Suspense fallback={<PageLoadingSkeleton />}><StudioSubmit /></Suspense>} />
                  <Route path="/studios/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><StudioProfile /></Suspense>} />
                  <Route path="/studios/:slug/insights" element={<Suspense fallback={<PageLoadingSkeleton />}><StudioInsights /></Suspense>} />
                  
                  
                  <Route path="/board/:token" element={<Suspense fallback={<PageLoadingSkeleton />}><ClientBoardViewer /></Suspense>} />
                  <Route path="/new-in" element={<Suspense fallback={<PageLoadingSkeleton />}><NewIn /></Suspense>} />
                  <Route path="/journal" element={<Suspense fallback={<PageLoadingSkeleton />}><Journal /></Suspense>} />
                  <Route path="/journal/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><JournalArticle /></Suspense>} />
                  <Route path="/spec-sheets/:slug" element={<Suspense fallback={null}><SpecSheetRedirect /></Suspense>} />
                  <Route path="/trade/spec-sheet" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeSpecSheet /></Suspense>} />
                  <Route path="/trade" element={<Suspense fallback={null}><TradeErrorBoundary><TradeLayout /></TradeErrorBoundary></Suspense>}>
                    <Route index element={<TradeDashboard />} />
                    <Route path="dashboard" element={<TradeDashboard />} />
                    <Route path="admin" element={<TradeAdmin />} />
                    <Route path="admin-dashboard" element={<TradeAdminDashboard />} />
                    <Route path="admin/concierge-usage" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeConciergeUsage /></Suspense>} />
                    <Route path="admin/ai-usage" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAiUsageDashboard /></Suspense>} />
                    <Route path="admin/ai-usage/print-check" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAiUsagePrintCheck /></Suspense>} />
                    <Route path="admin/rag-debug" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeRagDebug /></Suspense>} />

                    <Route path="registered-users" element={<TradeRegisteredUsers />} />
                    <Route path="description-writer" element={<TradeDescriptionWriter />} />
                    <Route path="gallery" element={<TradeGallery />} />
                    <Route path="gallery/:slug" element={<TradeGallery />} />
                    <Route path="quotes" element={<TradeQuotes />} />
                    <Route path="quotes/:quoteId/review" element={<TradeQuoteReview />} />
                    <Route path="quotes/:quoteId" element={<TradeQuotes />} />
                    <Route path="documents" element={<TradeDocuments />} />
                    <Route path="showroom" element={<TradeShowroom />} />
                    <Route path="samples" element={<TradeSamples />} />
                    <Route path="journal" element={<TradeJournal />} />
                    <Route path="provenance" element={<TradeProvenance />} />
                    <Route path="documents-admin" element={<TradeDocumentsAdmin />} />
                    <Route path="media" element={<TradeMediaLibrary />} />
                    <Route path="quotes-admin" element={<TradeQuotesAdmin />} />
                    <Route path="axonometric" element={<TradeAxonometric />} />
                    <Route path="axonometric-requests" element={<TradeAxonometricRequests />} />
                    <Route path="axonometric-gallery" element={<TradeAxonometricGallery />} />
                    <Route path="presentations" element={<TradePresentations />} />
                    <Route path="presentations/:id" element={<TradePresentationBuilder />} />
                    <Route path="presentations/:id/view" element={<TradePresentationViewer />} />
                    <Route path="favorites" element={<TradeFavorites />} />
                    <Route path="me" element={<TradeMyDashboard />} />
                    <Route path="favorites/folders/:id" element={<TradeFavoriteFolderDetail />} />
                    <Route path="tools/ffe" element={<TradeFfeTool />} />
                    <Route path="spatial-fit" element={<TradeSpatialFit />} />
                    <Route path="spatial-fit/audit" element={<TradeSpatialFitAudit />} />
                    <Route path="insights" element={<TradeInsights />} />
                    <Route path="downloads-by-country" element={<TradeDownloadsByCountry />} />
                    <Route path="magazine-analytics" element={<TradeMagazineAnalytics />} />
                    <Route path="designers" element={<TradeDesigners />} />
                    <Route path="designers/admin" element={<TradeDesignersAdmin />} />
                    <Route path="admin/product-audit" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeAdminProductAudit /></Suspense>} />
                    <Route path="designers/instagram" element={<TradeInstagramAudit />} />
                    <Route path="designers/:slug" element={<TradeAtelierProfile />} />
                    <Route path="products/:id" element={<TradeProductPage />} />
                    <Route path="products/:slug/:productSlug" element={<TradeProductPage />} />
                    <Route path="boards" element={<TradeBoards />} />
                    <Route path="boards/:id" element={<TradeBoardBuilder />} />
                    <Route path="projects" element={<TradeProjects />} />
                    <Route path="projects/:id" element={<TradeProjectDetail />} />
                    {/* spec-sheet moved to public route */}
                    <Route path="audit-log" element={<TradeAuditLog />} />
                    <Route path="client-profiles" element={<TradeClientProfiles />} />
                    <Route path="order-timeline" element={<TradeOrderTimeline />} />
                    <Route path="ffe-schedule" element={<TradeFFESchedule />} />
                    <Route path="ffe-export-test" element={<TradeFFEExportTest />} />
                    <Route path="materials" element={<TradeMaterialLibrary />} />
                    <Route path="tearsheets" element={<TradeTearsheets />} />
                    <Route path="annotations" element={<TradeAnnotations />} />
                    <Route path="shipping-tracker" element={<TradeShippingTracker />} />
                    <Route path="shipping-estimator" element={<TradeShippingEstimator />} />
                    <Route path="admin/shipping-rates" element={<TradeAdminShippingRates />} />
                    <Route path="admin/shipping-surcharges" element={<TradeAdminShippingSurcharges />} />
                    <Route path="admin/taxonomy-audit" element={<TradeAdminTaxonomyAudit />} />
                    <Route path="admin/duplicates" element={<TradeAdminDuplicates />} />
                    <Route path="admin/sync-status" element={<TradeAdminSyncStatus />} />
                    <Route path="admin/brand-lead-times" element={<TradeAdminBrandLeadTimes />} />
                    <Route path="admin/tiers" element={<TradeAdminTiers />} />
                    <Route path="admin/cad-assets" element={<TradeAdminCadAssets />} />
                    <Route path="admin/glb-models" element={<TradeAdminGlbModels />} />
                    <Route path="admin/og-pipeline" element={<TradeAdminOgPipeline />} />
                    <Route path="admin/onboarding" element={<TradeAdminOnboarding />} />
                    <Route path="admin/onboarding-funnel" element={<TradeAdminOnboardingFunnel />} />
                    
                    <Route path="admin/share-preview" element={<TradeAdminSharePreview />} />
                    <Route path="mood-boards" element={<TradeMoodBoards />} />
                    <Route path="budget" element={<TradeBudgetTracker />} />
                    <Route path="clients" element={<TradeClients />} />
                    <Route path="lead-time-calendar" element={<TradeLeadTimeCalendar />} />
                    <Route path="reorder" element={<TradeReorder />} />
                    <Route path="currency-converter" element={<TradeCurrencyConverter />} />
                    <Route path="cpd" element={<TradeCPD />} />
                    <Route path="comparator" element={<TradeComparator />} />
                    <Route path="tools" element={<TradeTools />} />
                    <Route path="floor-plan-ffe" element={<TradeFloorPlanFFE />} />
                    <Route path="guides" element={<TradeGuides />} />
                    <Route path="guides/analytics" element={<TradeGuidesAnalytics />} />
                    <Route path="guides/:slug" element={<TradeGuideDetail />} />
                    <Route path="custom-requests" element={<TradeCustomRequests />} />
                    <Route path="calendar" element={<TradeFairCalendar />} />
                    <Route path="settings" element={<TradeSettings />} />
                    <Route path="settings/studio" element={<TradeStudioSettings />} />
                  </Route>

                  <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPolicy /></Suspense>} />
                  <Route path="/terms" element={<Suspense fallback={null}><TermsOfService /></Suspense>} />
                  <Route path="/unsubscribe" element={<Suspense fallback={null}><Unsubscribe /></Suspense>} />
                  <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
                </Routes>
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
        </CompareProvider>
        </StudioProvider>
        </AuthProvider>
      </LazyHelmetProvider>
    </Suspense>
  );
};

export default App;
