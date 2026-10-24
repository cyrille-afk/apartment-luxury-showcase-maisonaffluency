/* Shared route helpers and lazy page components ported from the pre-TanStack App.tsx. */
import AdminOnly from "@/components/trade/AdminOnly";
import { isCollectionLanding, shouldResetRouteScroll } from "@/lib/collectionScrollPolicy";
import { isTradeGalleryListing, readTradeGalleryState } from "@/lib/tradeGalleryState";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import LegacyRouteRedirect from "@/components/LegacyRouteRedirect";
import { GlobalCanonical } from "@/components/GlobalCanonical";
import { Navigate, useLocation, useNavigate, useNavigationType, useParams } from "@/lib/router-compat";
// Index is the homepage and is loaded synchronously: lazy-loading it created
// a sequential chunk waterfall (main → Index → Hero) that delayed LCP on
// throttled mobile. Below-fold homepage sections stay lazy inside Index.
import Index from "@/pages/Index";
import { CompareProvider } from "@/contexts/CompareContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { CheckoutFormProvider } from "@/contexts/CheckoutFormContext";
import { TradeCopilotProvider } from "@/contexts/TradeCopilotContext";
import { VisualiserMaterialProvider } from "@/contexts/VisualiserMaterialContext";
import { ProjectInventoryProvider } from "@/contexts/ProjectInventoryContext";
import { AuthProvider } from "@/hooks/useAuth";
import ClientCurrencyDetection from "@/components/ClientCurrencyDetection";
import GoogleOAuthReturnRecovery from "@/components/GoogleOAuthReturnRecovery";
import { StudioProvider } from "@/hooks/useStudio";
import { RealtimeMultiplexerProvider } from "@/contexts/RealtimeMultiplexerContext";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import { releaseDesignersLandingScrollLock } from "@/lib/designersScrollLock";
import { clearDarkIosChrome } from "@/lib/iosChrome";

// react-helmet-async is imported synchronously — wrapping the whole app in a
// lazy provider with Suspense fallback={null} blocked ALL React rendering on a
// separate chunk, which delayed every page's first paint.

// Lazy-load non-landing pages and non-critical UI
export const NotFound = lazy(() => import("@/pages/NotFound"));
export const MobilePreviewShareButton = lazy(() => import("@/components/MobilePreviewShareButton"));
export const ComingSoon = lazy(() => import("@/pages/ComingSoon"));
export const DesignerUpload = lazy(() => import("@/pages/DesignerUpload"));
export const TradePurgeCache = lazy(() => import("@/pages/TradePurgeCache"));

export function LegacyStephGcRedirect() {
  const { productSlug } = useParams();
  return <Navigate to={`/designers/steph-gc${productSlug ? `/${productSlug}` : ""}`} replace />;
}

export function ShowroomLegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/trade/the-collection${search}`} replace />;
}

export function LegacyTradeDesignerRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const { search } = useLocation();
  return <Navigate to={slug ? `/trade/gallery/${slug}${search}` : `/trade/designers${search}`} replace />;
}

// Trade portal pages
export const TradeLogin = lazy(() => import("@/pages/TradeLogin"));
export const OAuthConsent = lazy(() => import("@/pages/OAuthConsent"));
export const TradeFaqPage = lazy(() => import("@/pages/TradeFaqPage"));
export const GuestPayPage = lazy(() => import("@/pages/GuestPayPage"));
import GallerySkeleton from "@/components/trade/GallerySkeleton";
import LegacyTradeSignupRedirect from "@/components/trade/LegacyTradeSignupRedirect";
import { isOwnSpecSheetUrl, SPEC_SHEET_NAVIGATE_EVENT } from "@/lib/specSheetUrl";
export const TradeLanding = lazy(() => import("@/pages/TradeLanding"));

export const TradeActivate = lazy(() => import("@/pages/TradeActivate"));
export const TradeClientDashboard = lazy(() => import("@/pages/TradeClientDashboard"));
export const TradeOnboarding = lazy(() => import("@/pages/TradeOnboarding"));
export const TradeDemoPage = lazy(() => import("@/pages/TradeDemoPage"));
export const Studios = lazy(() => import("@/pages/Studios"));
export const StudioSubmit = lazy(() => import("@/pages/StudioSubmit"));
export const StudioProfile = lazy(() => import("@/pages/StudioProfile"));
export const StudioInsights = lazy(() => import("@/pages/StudioInsights"));
export const CollectorSignup = lazy(() => import("@/pages/CollectorSignup"));
export const TradeLayout = lazy(() => import("@/pages/TradeLayout"));
export const TradeMobileLaunch = lazy(() => import("@/pages/TradeMobileLaunch"));
export const TradeGuides = lazy(() => import("@/pages/TradeGuides"));
export const TradeGuideDetail = lazy(() => import("@/pages/TradeGuideDetail"));
export const TradeGuidesAnalytics = lazy(() => import("@/pages/TradeGuidesAnalytics"));
export const TradeErrorBoundary = lazy(() => import("@/components/trade/TradeErrorBoundary"));
export const TradeDashboard = lazy(() => import("@/pages/TradeDashboard"));
export const TradeAdmin = lazy(() => import("@/pages/TradeAdmin"));
export const TradeAdminTools = lazy(() => import("@/pages/TradeAdminTools"));
export const TradeAdminDashboard = lazy(() => import("@/pages/TradeAdminDashboard"));
export const TradeConciergeUsage = lazy(() => import("@/pages/TradeConciergeUsage"));
export const TradeAiUsageDashboard = lazy(() => import("@/pages/TradeAiUsageDashboard"));
export const TradeIngestionQueue = lazy(() => import("@/pages/TradeIngestionQueue"));
export const TradeRagDebug = lazy(() => import("@/pages/TradeRagDebug"));
export const TradeAiUsagePrintCheck = lazy(() => import("@/pages/TradeAiUsagePrintCheck"));
export const TradeAdminConciergeLeads = lazy(() => import("@/pages/TradeAdminConciergeLeads"));
export const TradeAdminInquiries = lazy(() => import("@/pages/TradeAdminInquiries"));
export const TradeAdminCollectorApplications = lazy(() => import("@/pages/TradeAdminCollectorApplications"));
export const TradeAdminPortalInvites = lazy(() => import("@/pages/TradeAdminPortalInvites"));
export const TradeAdminCnBriefs = lazy(() => import("@/pages/TradeAdminCnBriefs"));
export const PortalCN = lazy(() => import("@/pages/PortalCN"));
export const TradeAdminMcpUsage = lazy(() => import("@/pages/TradeAdminMcpUsage"));
export const TradeAdminQueue = lazy(() => import("@/pages/TradeAdminQueue"));
export const TradeAdminStripeMetrics = lazy(() => import("@/pages/TradeAdminStripeMetrics"));
export const TradeAdminStudios = lazy(() => import("@/pages/TradeAdminStudios"));
export const TradeAdminStudioDetail = lazy(() => import("@/pages/TradeAdminStudioDetail"));
export const TradeAdminCuratedPairings = lazy(() => import("@/pages/TradeAdminCuratedPairings"));
export const TradeAdminPrivacyRequests = lazy(() => import("@/pages/TradeAdminPrivacyRequests"));
export const TradeAdminSubProcessors = lazy(() => import("@/pages/TradeAdminSubProcessors"));
export const TradeAdminOutbound = lazy(() => import("@/pages/TradeAdminOutbound"));
export const TradeAdminEmailDeliverability = lazy(() => import("@/pages/TradeAdminEmailDeliverability"));
export const TradeAdminKpiLedger = lazy(() => import("@/pages/TradeAdminKpiLedger"));
export const TradeAdminAcquisitions = lazy(() => import("@/pages/TradeAdminAcquisitions"));
export const TradeAdminFelixUsage = lazy(() => import("@/pages/TradeAdminFelixUsage"));
export const TradeAdminDesignNoteResearch = lazy(() => import("@/pages/TradeAdminDesignNoteResearch"));
export const TradeAdminDesignNoteCoverage = lazy(() => import("@/pages/TradeAdminDesignNoteCoverage"));
export const TradeAdminServiceRequests = lazy(() => import("@/pages/TradeAdminServiceRequests"));
export const TradeAdminApplications = lazy(() => import("@/pages/TradeAdminApplications"));
export const DpaTemplate = lazy(() => import("@/pages/DpaTemplate"));
export const TradePayoutStatement = lazy(() => import("@/pages/TradePayoutStatement"));

export const TradeDescriptionWriter = lazy(() => import("@/pages/TradeDescriptionWriter"));
export const TradeRegisteredUsers = lazy(() => import("@/pages/TradeRegisteredUsers"));
export const TradeGallery = lazy(() => import("@/pages/TradeGallery"));
export const ChatGPTTradeSidebar = lazy(() => import("@/components/trade/ChatGPTTradeSidebar"));
export const TradeExtensionSync = lazy(() => import("@/pages/TradeExtensionSync"));
export const TradeDocuments = lazy(() => import("@/pages/TradeDocuments"));
export const TradeDownloadsByCountry = lazy(() => import("@/pages/TradeDownloadsByCountry"));

export const TradeQuotes = lazy(() => import("@/pages/TradeQuotes"));
export const TradeQuoteReview = lazy(() => import("@/pages/TradeQuoteReview"));
export const TradeSettings = lazy(() => import("@/pages/TradeSettings"));
export const BetaFeedboard = lazy(() => import("@/pages/BetaFeedboard"));
export const TradeStudioSettings = lazy(() => import("@/pages/TradeStudioSettings"));
export const TradeOrderTimeline = lazy(() => import("@/pages/TradeOrderTimeline"));
export const TradeFFESchedule = lazy(() => import("@/pages/TradeFFESchedule"));
export const TradeDeliveryTracker = lazy(() => import("@/pages/TradeDeliveryTracker"));
export const TradeFFEExportTest = lazy(() => import("@/pages/TradeFFEExportTest"));
export const TradeMaterialLibrary = lazy(() => import("@/pages/TradeMaterialLibrary"));
export const TradeProjectWorkspace = lazy(() => import("@/pages/TradeProjectWorkspace"));
export const TradeTearsheets = lazy(() => import("@/pages/TradeTearsheets"));
export const TradeAnnotations = lazy(() => import("@/pages/TradeAnnotations"));
export const TradeShippingTracker = lazy(() => import("@/pages/TradeShippingTracker"));
export const TradeShippingEstimator = lazy(() => import("@/pages/TradeShippingEstimator"));
export const TradeAdminShippingRates = lazy(() => import("@/pages/TradeAdminShippingRates"));
export const TradeAdminShippingSurcharges = lazy(() => import("@/pages/TradeAdminShippingSurcharges"));
export const TradeAdminTaxonomyAudit = lazy(() => import("@/pages/TradeAdminTaxonomyAudit"));
export const TradeAdminDescriptorTaxonomy = lazy(() => import("@/pages/TradeAdminDescriptorTaxonomy"));
export const TradeAdminSyncStatus = lazy(() => import("@/pages/TradeAdminSyncStatus"));
export const TradeAdminBrandLeadTimes = lazy(() => import("@/pages/TradeAdminBrandLeadTimes"));
export const TradeAdminFabrics = lazy(() => import("@/pages/TradeAdminFabrics"));
export const TradeAdminBulkFinishes = lazy(() => import("@/pages/TradeAdminBulkFinishes"));
export const TradeAdminTiers = lazy(() => import("@/pages/TradeAdminTiers"));
export const TradeAdminCadAssets = lazy(() => import("@/pages/TradeAdminCadAssets"));
export const TradeAdminGlbModels = lazy(() => import("@/pages/TradeAdminGlbModels"));
export const TradeAdminDuplicateScan = lazy(() => import("@/pages/TradeAdminDuplicateScan"));
export const TradeAdminOgPipeline = lazy(() => import("@/pages/TradeAdminOgPipeline"));
export const TradeAdminOnboarding = lazy(() => import("@/pages/TradeAdminOnboarding"));
export const TradeAdminOnboardingFunnel = lazy(() => import("@/pages/TradeAdminOnboardingFunnel"));

export const TradeAdminSharePreview = lazy(() => import("@/pages/TradeAdminSharePreview"));
export const TradeAdminHotspotMapping = lazy(() => import("@/pages/TradeAdminHotspotMapping"));
export const TradeMoodBoards = lazy(() => import("@/pages/TradeMoodBoards"));
export const TradeBudgetTracker = lazy(() => import("@/pages/TradeBudgetTracker"));
export const TradePOLogs = lazy(() => import("@/pages/TradePOLogs"));
export const TradeGanttTimeline = lazy(() => import("@/pages/TradeGanttTimeline"));
export const TradeSpecSheetGenerator = lazy(() => import("@/pages/TradeSpecSheetGenerator"));
export const TradeClients = lazy(() => import("@/pages/TradeClients"));
export const TradeLeadTimeCalendar = lazy(() => import("@/pages/TradeLeadTimeCalendar"));
export const TradeReorder = lazy(() => import("@/pages/TradeReorder"));
export const TradeCurrencyConverter = lazy(() => import("@/pages/TradeCurrencyConverter"));
export const TradeCPD = lazy(() => import("@/pages/TradeCPD"));
export const TradeComparator = lazy(() => import("@/pages/TradeComparator"));
export const SharedShortlist = lazy(() => import("@/pages/SharedShortlist"));
export const TradeTools = lazy(() => import("@/pages/TradeTools"));

export const TradeShowroom = lazy(() => import("@/pages/TradeShowroom"));
export const TradeAILayoutStudio = lazy(() => import("@/pages/TradeAILayoutStudio"));
export const TradeSamples = lazy(() => import("@/pages/TradeSamples"));
export const TradeJournal = lazy(() => import("@/pages/TradeJournal"));
export const TradeProvenance = lazy(() => import("@/pages/TradeProvenance"));
export const TradeDocumentsAdmin = lazy(() => import("@/pages/TradeDocumentsAdmin"));
export const TradeMediaLibrary = lazy(() => import("@/pages/TradeMediaLibrary"));
export const TradeQuotesAdmin = lazy(() => import("@/pages/TradeQuotesAdmin"));
export const TradeAxonometricRequests = lazy(() => import("@/pages/TradeAxonometricRequests"));

export const TradeCustomRequests = lazy(() => import("@/pages/TradeCustomRequests"));
export const TradeFairCalendar = lazy(() => import("@/pages/TradeFairCalendar"));
export const TradeAxonometricGallery = lazy(() => import("@/pages/TradeAxonometricGallery"));
export const TradePresentations = lazy(() => import("@/pages/TradePresentations"));
export const TradePresentationBuilder = lazy(() => import("@/pages/TradePresentationBuilder"));
export const TradePresentationViewer = lazy(() => import("@/pages/TradePresentationViewer"));
export const TradeFavorites = lazy(() => import("@/pages/TradeFavorites"));
export const TradeMyDashboard = lazy(() => import("@/pages/TradeMyDashboard"));
export const TradeFavoriteFolderDetail = lazy(() => import("@/pages/TradeFavoriteFolderDetail"));
export const TradeFfeTool = lazy(() => import("@/pages/TradeFfeTool"));
export const TradeSpatialFit = lazy(() => import("@/pages/TradeSpatialFit"));
export const TradeSpatialFitAudit = lazy(() => import("@/pages/TradeSpatialFitAudit"));
export const TradeBoards = lazy(() => import("@/pages/TradeBoards"));
export const TradeSharedRooms = lazy(() => import("@/pages/TradeSharedRooms"));
export const TradeBoardBuilder = lazy(() => import("@/pages/TradeBoardBuilder"));
export const TradeProjects = lazy(() => import("@/pages/TradeProjects"));
export const TradeProjectDetail = lazy(() => import("@/pages/TradeProjectDetail"));
export const TradeProjectStudio = lazy(() => import("@/pages/TradeProjectStudio"));
export const ClientBoardViewer = lazy(() => import("@/pages/ClientBoardViewer"));
export const SharedAILayout = lazy(() => import("@/pages/SharedAILayout"));
export const SharedProcurementBoard = lazy(() => import("@/pages/SharedProcurementBoard"));
export const TradeInsights = lazy(() => import("@/pages/TradeInsights"));
export const TradeDesigners = lazy(() => import("@/pages/TradeDesigners"));
export const TradeConcierge = lazy(() => import("@/pages/TradeConcierge"));
export const TradeDesignersAdmin = lazy(() => import("@/pages/TradeDesignersAdmin"));
export const TradeAdminSuppliers = lazy(() => import("@/pages/TradeAdminSuppliers"));
export const TradeCollectiblesAdmin = lazy(() => import("@/pages/TradeCollectiblesAdmin"));
export const TradeAdminProductAudit = lazy(() => import("@/pages/TradeAdminProductAudit"));
export const TradePriceDriftAudit = lazy(() => import("@/pages/TradePriceDriftAudit"));
export const TradeInstagramAudit = lazy(() => import("@/pages/TradeInstagramAudit"));
export const TradeAuditLog = lazy(() => import("@/pages/TradeAuditLog"));
export const TradeClientProfiles = lazy(() => import("@/pages/TradeClientProfiles"));
export const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
export const NewIn = lazy(() => import("@/pages/NewIn"));
export const Journal = lazy(() => import("@/pages/Journal"));
export const JournalArticle = lazy(() => import("@/pages/JournalArticle"));
export const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
export const TermsOfService = lazy(() => import("@/pages/TermsOfService"));
export const ProductPage = lazy(() => import("@/pages/ProductPage"));
export const DesignerProfile = lazy(() => import("@/pages/DesignerProfile"));
export const PublicDesigners = lazy(() => import("@/pages/PublicDesigners"));
export const PublicDesignerProfile = lazy(() => import("@/pages/PublicDesignerProfile"));
export const RoomSearch = lazy(() => import("@/pages/RoomSearch"));
export const PublicDesignerBiography = lazy(() => import("@/pages/PublicDesignerBiography"));
export const PublicFavorites = lazy(() => import("@/pages/PublicFavorites"));
export const TradeSpecSheet = lazy(() => import("@/pages/TradeSpecSheet"));
export const ApartmentTour = lazy(() => import("@/pages/ApartmentTour"));
export const SpecSheetRedirect = lazy(() => import("@/pages/SpecSheetRedirect"));
export const PublicGallery = lazy(() => import("@/pages/PublicGallery"));
export const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));
export const ContactPage = lazy(() => import("@/pages/ContactPage"));
export const CartPage = lazy(() => import("@/pages/Cart"));
export const CartIdentifyPage = lazy(() => import("@/pages/CartIdentify"));
export const OrderConfirmationPage = lazy(() => import("@/pages/OrderConfirmation"));
export const SuccessPage = lazy(() => import("@/pages/Success"));
export const PaymentFailedPage = lazy(() => import("@/pages/PaymentFailed"));
export const PoAcknowledgePage = lazy(() => import("@/pages/PoAcknowledge"));
export const CheckoutPage = lazy(() => import("@/pages/Checkout"));
export const BankWireInstructionsPage = lazy(() => import("@/pages/BankWireInstructions"));
export const ConciergePage = lazy(() => import("@/pages/ConciergePage"));
export const ProductPageContainer = lazy(() => import("@/pages/ProductPageContainer"));
export const CategoryRoute = lazy(() => import("@/pages/CategoryRoute"));
export const ScreenshotGallery = lazy(() => import("@/pages/ScreenshotGallery"));
export const CuratorsPicksDemo = lazy(() => import("@/pages/CuratorsPicksDemo"));



// Defer heavy providers + toast UI — not needed for hero/LCP
export const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
export const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
export const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));
export const TradeAdminDuplicates = lazy(() => import("@/pages/TradeAdminDuplicates"));
export const TradeAdminWhatsAppAlerts = lazy(() => import("@/pages/TradeAdminWhatsAppAlerts"));
export const TradeAdminPaymentSettings = lazy(() => import("@/pages/TradeAdminPaymentSettings"));
export const DevCheckoutTest = lazy(() => import("@/pages/DevCheckoutTest"));
export const TradeAdminFunnelTracker = lazy(() => import("@/pages/TradeAdminFunnelTracker"));
export const TradeAdminSalesFunnel = lazy(() => import("@/pages/TradeAdminSalesFunnel"));
export const TradeAdminProcurementLedger = lazy(() => import("@/pages/TradeAdminProcurementLedger"));
export const TradeAdminAxonometricCadQa = lazy(() => import("@/pages/TradeAdminAxonometricCadQa"));
export const CookieConsent = lazy(() => import("@/components/CookieConsent"));

// Set to false to disable maintenance mode and show the real site
export const MAINTENANCE_MODE = false;

export const PageTracker = lazy(() => import("@/hooks/usePageTracking").then(m => {
  const Tracker = () => { m.default(); return null; };
  return { default: Tracker };
}));

export const queryClientDefaultOptions = ({
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
}).defaultOptions;

const PREVIEW_VIEW_STATE_KEY = "ma:preview-view-state";
let previewLocationRestored = false;

/** Sign-in / recovery screens must never be remembered or restored on reload.
 *  /trade-program is included: its landing shows the sign-in gate to signed-out
 *  visitors, so restoring it on refresh would trap members on "Trade Program
 *  Sign In" instead of the page they chose. */
export function isTransientAuthPath(path: string): boolean {
  return /^\/(trade\/login|trade-program|reset-password|auth|~oauth)(\/|$)/.test(path);
}

export function getPreviewAnchorId(): string | undefined {
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

export function isPreviewOrDev(): boolean {
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
export function HomeRouteSync() {
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
export function ScrollToTopOnNavigate() {
  const location = useLocation();
  const navType = useNavigationType();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = location.pathname;
    // Same-route query updates are in-page filters; keep the user at the
    // directory instead of jumping back to the route hero.
    if (!shouldResetRouteScroll(prevPath, location.pathname)) return;
    if (navType === "POP") return;
    if (isTradeGalleryListing(location.pathname) && (readTradeGalleryState(location.pathname).scrollY ?? 0) > 0) return;
    if (location.hash) return;
    const state = location.state as { preserveScroll?: boolean; smoothScroll?: boolean } | null;
    if (state?.preserveScroll) return;
    const isLockedDesignersLanding =
      location.pathname === "/designers" &&
      !location.search &&
      (window.matchMedia?.("(max-width: 767px)").matches ||
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true);
    const requiresStableTop = isCollectionLanding(location.pathname);
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const smooth = !isLockedDesignersLanding && !requiresStableTop && state?.smoothScroll !== false && !prefersReduced;
    const behavior: ScrollBehavior = smooth ? "smooth" : "instant";
    // Defer one frame so the new route mounts before we animate — prevents the
    // browser from snapping mid-transition when React commits the new tree.
    const raf = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.key, location.pathname, location.hash, location.state, navType]);

  return null;
}

export function RouteScrollLockFailsafe() {
  const location = useLocation();

  useLayoutEffect(() => {
    const isTradeRoute = location.pathname.includes("/trade");
    document.documentElement.classList.toggle("hide-whatsapp-widget", isTradeRoute);

    const markFloatingWhatsAppWidgets = () => {
      if (!isTradeRoute) return;

      const candidates = document.querySelectorAll<HTMLElement>(
        '#whatsapp-floating-widget, [id*="whatsapp-widget" i], [class*="whatsapp-widget" i], [data-widget*="whatsapp" i], a[href*="wa.me" i], a[href*="api.whatsapp.com" i], iframe[src*="whatsapp" i]'
      );

      candidates.forEach((candidate) => {
        let element: HTMLElement | null = candidate;
        while (element && element !== document.body) {
          const style = window.getComputedStyle(element);
          if (style.position === "fixed") {
            element.setAttribute("data-trade-floating-whatsapp", "hidden");
            break;
          }
          element = element.parentElement;
        }
      });
    };

    markFloatingWhatsAppWidgets();
    const whatsappWidgetObserver = new MutationObserver(markFloatingWhatsAppWidgets);
    if (isTradeRoute) {
      whatsappWidgetObserver.observe(document.body, { childList: true, subtree: true });
      window.addEventListener("resize", markFloatingWhatsAppWidgets);
    }

    const isPublicProductDetail = /^\/designers\/[^/]+\/[^/]+\/?$/.test(location.pathname);
    const isProductDetail =
      isPublicProductDetail;
    document.documentElement.classList.toggle("product-detail-root", isProductDetail);
    document.documentElement.classList.toggle("public-product-canvas", isPublicProductDetail);
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
    return () => {
      whatsappWidgetObserver.disconnect();
      window.removeEventListener("resize", markFloatingWhatsAppWidgets);
      document.querySelectorAll('[data-trade-floating-whatsapp="hidden"]').forEach((element) => {
        element.removeAttribute("data-trade-floating-whatsapp");
      });
      document.documentElement.classList.remove("product-detail-root");
      document.documentElement.classList.remove("public-product-canvas");
    };
  }, [location.pathname]);

  return null;
}


export function PreviewViewContinuity() {
  const location = useLocation();
  const anchorIdRef = useRef<string | undefined>(undefined);

  const isLockedDesignersLanding = location.pathname === "/designers" && !location.search;
  const requiresStableTop = isCollectionLanding(location.pathname);


  useEffect(() => {
    if (!isPreviewOrDev()) return;

    let timer: number | null = null;
    const save = () => {
      if (isTransientAuthPath(location.pathname)) return;
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
      if (isLockedDesignersLanding || requiresStableTop) return;
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
  }, [location.pathname, location.search, isLockedDesignersLanding, requiresStableTop]);

  useEffect(() => {
    if (!isPreviewOrDev()) return;
    if (isLockedDesignersLanding || requiresStableTop) {
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
  }, [location.pathname, location.search, requiresStableTop]);

  return null;
}

/** Browser Back/Forward onto "/" must land on the homepage, never the
 *  remembered last page — only fresh loads and refreshes restore it. */
export function isHistoryTraversalLoad(entries: Array<{ type?: string }> | undefined): boolean {
  return entries?.[0]?.type === "back_forward";
}

export function restorePreviewLocationBeforeRouter() {
  if (previewLocationRestored || !isPreviewOrDev() || typeof window === "undefined") return;
  previewLocationRestored = true;
  try {
    if (isHistoryTraversalLoad(performance.getEntriesByType?.("navigation") as Array<{ type?: string }>)) return;
  } catch { /* noop */ }

  try {
    const raw = localStorage.getItem(PREVIEW_VIEW_STATE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { path?: string; search?: string; ts?: number };
    // The preview frame reloads to "/" on every hard refresh; keep returning
    // the member to the page they were working on for a full working day.
    const isFresh = typeof saved.ts === "number" && Date.now() - saved.ts < 12 * 60 * 60 * 1000;
    const currentSearch = new URLSearchParams(window.location.search);
    currentSearch.delete("__lovable_token");
    const currentIsRoot = window.location.pathname === "/" && !currentSearch.toString() && !window.location.hash;
    const savedPath = saved.path || "/";

    // Never bounce back onto a sign-in/recovery screen, and never hijack the
    // root landing that an OAuth sign-in returns to — doing either traps the
    // member on "Trade Program Sign In" after they have signed in.
    let oauthPending = false;
    try { oauthPending = !!sessionStorage.getItem("maison:oauth-return-path"); } catch { /* noop */ }
    if (isTransientAuthPath(savedPath) || oauthPending) return;

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

export function SameOriginLinkGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      // Our spec-sheet viewer always opens in this tab so the sign-in carries over.
      const ownSpecSheet = isOwnSpecSheetUrl(anchor.href);
      if (ownSpecSheet) {
        event.preventDefault();
        event.stopPropagation();
        navigate(`${ownSpecSheet.pathname}${ownSpecSheet.search}`);
        return;
      }
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      // Links that intercept their own first tap (e.g. touch preview on the
      // dashboard walkthrough card) opt out of this global navigation handler.
      if (anchor.hasAttribute("data-tap-preview")) return;

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

    const onSpecSheet = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (typeof next === "string") navigate(next);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(SPEC_SHEET_NAVIGATE_EVENT, onSpecSheet);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(SPEC_SHEET_NAVIGATE_EVENT, onSpecSheet);
    };
  }, [navigate]);

  return null;
}

// Preview-only navigation trace: records every route change with its caller so
// an unexplained bounce (e.g. admin page → "/") can be attributed from logs.
let previewNavTraceInstalled = false;
export function installPreviewNavTrace() {
  if (previewNavTraceInstalled || typeof window === "undefined" || !isPreviewOrDev()) return;
  previewNavTraceInstalled = true;
  const t0 = performance.now();
  const stamp = () => `${Math.round(performance.now() - t0)}ms`;
  const caller = () => (new Error().stack || "").split("\n").slice(3, 9).map((l) => l.trim()).join(" | ");
  // Events before a full reload would otherwise be lost: keep a short buffer
  // across reloads and replay it at boot. warn level so preview capture keeps it.
  const BUF = "ma:nav-trace";
  let buffer: string[] = [];
  try { buffer = JSON.parse(sessionStorage.getItem(BUF) || "[]"); } catch { buffer = []; }
  if (buffer.length) console.warn("[nav-trace] previous loads:\n" + buffer.join("\n"));
  const log = (...parts: unknown[]) => {
    const line = `${new Date().toISOString().slice(11, 23)} ${parts.map(String).join(" ")}`;
    console.warn("[nav-trace]", line);
    buffer = [...buffer, line].slice(-40);
    try { sessionStorage.setItem(BUF, JSON.stringify(buffer)); } catch { /* noop */ }
  };
  log("boot", stamp(), window.location.pathname + window.location.search, "framed:", window.parent !== window, "referrer:", document.referrer || "-");
  (["pushState", "replaceState"] as const).forEach((method) => {
    const original = window.history[method].bind(window.history);
    window.history[method] = ((state: unknown, title: string, url?: string | URL | null) => {
      const from = window.location.pathname;
      const result = original(state, title, url);
      const to = window.location.pathname;
      if (from !== to) log(method, stamp(), from, "->", to, caller());
      return result;
    }) as History[typeof method];
  });
  window.addEventListener("popstate", () => log("popstate", stamp(), window.location.pathname));
  window.addEventListener("pagehide", () => log("pagehide", stamp(), window.location.pathname));
  window.addEventListener("message", (e) => {
    // Ignore cross-origin messages: without this check any framed or framing
    // page could inject crafted entries into the navigation trace log.
    if (e.origin !== window.location.origin) return;
    const type = (e.data && typeof e.data === "object" && (e.data as { type?: unknown }).type) || "";
    if (typeof type === "string" && /navigat|route|url|path|reload/i.test(type)) {
      log("message", stamp(), e.origin, type, JSON.stringify(e.data).slice(0, 200));
    }
  });
}


export function TradeApplyRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/trade-program${search}`} replace />;
}

export { AdminOnly, LegacyRouteRedirect, GlobalCanonical, Index, ClientCurrencyDetection, GoogleOAuthReturnRecovery, PageLoadingSkeleton, GallerySkeleton, LegacyTradeSignupRedirect };
export { CompareProvider, WishlistProvider, CheckoutFormProvider, TradeCopilotProvider, VisualiserMaterialProvider, ProjectInventoryProvider, AuthProvider, StudioProvider, RealtimeMultiplexerProvider };

/** App-level browser effects ported from the pre-TanStack App component. */
export function useLegacyAppEffects(): boolean {
  useEffect(() => {
    installPreviewNavTrace();
    restorePreviewLocationBeforeRouter();
  }, []);
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

  return showDeferredUi;
}
