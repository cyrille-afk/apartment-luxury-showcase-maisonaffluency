import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "./pages/Index";
import TradeAxonometric from "./pages/TradeAxonometric";
import { CompareProvider } from "@/contexts/CompareContext";
import { AuthProvider } from "@/hooks/useAuth";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";

// Defer react-helmet-async — all critical meta tags are already in index.html
const LazyHelmetProvider = lazy(() =>
  import("react-helmet-async").then(m => ({ default: m.HelmetProvider }))
);

// Lazy-load non-landing pages and non-critical UI
const NotFound = lazy(() => import("./pages/NotFound"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));

// Trade portal pages
const TradeLogin = lazy(() => import("./pages/TradeLogin"));
const TradeLanding = lazy(() => import("./pages/TradeLanding"));
const TradeRegister = lazy(() => import("./pages/TradeRegister"));
const TradeLayout = lazy(() => import("./pages/TradeLayout"));
const TradeErrorBoundary = lazy(() => import("./components/trade/TradeErrorBoundary"));
const TradeDashboard = lazy(() => import("./pages/TradeDashboard"));
const TradeAdmin = lazy(() => import("./pages/TradeAdmin"));
const TradeAdminDashboard = lazy(() => import("./pages/TradeAdminDashboard"));
const TradeDescriptionWriter = lazy(() => import("./pages/TradeDescriptionWriter"));
const TradeRegisteredUsers = lazy(() => import("./pages/TradeRegisteredUsers"));
const TradeGallery = lazy(() => import("./pages/TradeGallery"));
const TradeDocuments = lazy(() => import("./pages/TradeDocuments"));
const TradeDownloadsByCountry = lazy(() => import("./pages/TradeDownloadsByCountry"));
const TradeQuotes = lazy(() => import("./pages/TradeQuotes"));
const TradeSettings = lazy(() => import("./pages/TradeSettings"));
const TradeOrderTimeline = lazy(() => import("./pages/TradeOrderTimeline"));
const TradeFFESchedule = lazy(() => import("./pages/TradeFFESchedule"));
const TradeMaterialLibrary = lazy(() => import("./pages/TradeMaterialLibrary"));
const TradeTearsheets = lazy(() => import("./pages/TradeTearsheets"));
const TradeAnnotations = lazy(() => import("./pages/TradeAnnotations"));
const TradeShippingTracker = lazy(() => import("./pages/TradeShippingTracker"));
const TradeShippingEstimator = lazy(() => import("./pages/TradeShippingEstimator"));
const TradeAdminShippingRates = lazy(() => import("./pages/TradeAdminShippingRates"));
const TradeAdminShippingSurcharges = lazy(() => import("./pages/TradeAdminShippingSurcharges"));
const TradeAdminTaxonomyAudit = lazy(() => import("./pages/TradeAdminTaxonomyAudit"));
const TradeMoodBoards = lazy(() => import("./pages/TradeMoodBoards"));
const TradeBudgetTracker = lazy(() => import("./pages/TradeBudgetTracker"));
const TradeLeadTimeCalendar = lazy(() => import("./pages/TradeLeadTimeCalendar"));
const TradeReorder = lazy(() => import("./pages/TradeReorder"));
const TradeCurrencyConverter = lazy(() => import("./pages/TradeCurrencyConverter"));
const TradeCPD = lazy(() => import("./pages/TradeCPD"));
const TradeComparator = lazy(() => import("./pages/TradeComparator"));
const TradeTools = lazy(() => import("./pages/TradeTools"));
const TradeShowroom = lazy(() => import("./pages/TradeShowroom"));
const TradeSamples = lazy(() => import("./pages/TradeSamples"));
const TradeJournal = lazy(() => import("./pages/TradeJournal"));
const TradeProvenance = lazy(() => import("./pages/TradeProvenance"));
const TradeDocumentsAdmin = lazy(() => import("./pages/TradeDocumentsAdmin"));
const TradeMediaLibrary = lazy(() => import("./pages/TradeMediaLibrary"));
const TradeQuotesAdmin = lazy(() => import("./pages/TradeQuotesAdmin"));
const TradeAxonometricRequests = lazy(() => import("./pages/TradeAxonometricRequests"));
const TradeAxonometricGallery = lazy(() => import("./pages/TradeAxonometricGallery"));
const TradePresentations = lazy(() => import("./pages/TradePresentations"));
const TradePresentationBuilder = lazy(() => import("./pages/TradePresentationBuilder"));
const TradePresentationViewer = lazy(() => import("./pages/TradePresentationViewer"));
const TradeFavorites = lazy(() => import("./pages/TradeFavorites"));
const TradeBoards = lazy(() => import("./pages/TradeBoards"));
const TradeBoardBuilder = lazy(() => import("./pages/TradeBoardBuilder"));
const ClientBoardViewer = lazy(() => import("./pages/ClientBoardViewer"));
const TradeInsights = lazy(() => import("./pages/TradeInsights"));
const TradeDesigners = lazy(() => import("./pages/TradeDesigners"));
const TradeDesignersAdmin = lazy(() => import("./pages/TradeDesignersAdmin"));
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
const PublicProductPage = lazy(() => import("./pages/PublicProductPage"));
const CategoryRoute = lazy(() => import("./pages/CategoryRoute"));


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

const queryClient = new QueryClient();

const App = () => {
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
        <CompareProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
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
                  <Route path="/apartment-tour" element={<Suspense fallback={<PageLoadingSkeleton />}><ApartmentTour /></Suspense>} />
                  
                  
                  <Route path="/board/:token" element={<Suspense fallback={<PageLoadingSkeleton />}><ClientBoardViewer /></Suspense>} />
                  <Route path="/new-in" element={<Suspense fallback={<PageLoadingSkeleton />}><NewIn /></Suspense>} />
                  <Route path="/journal" element={<Suspense fallback={<PageLoadingSkeleton />}><Journal /></Suspense>} />
                  <Route path="/journal/:slug" element={<Suspense fallback={<PageLoadingSkeleton />}><JournalArticle /></Suspense>} />
                  <Route path="/spec-sheets/:slug" element={<Suspense fallback={null}><SpecSheetRedirect /></Suspense>} />
                  <Route path="/trade/spec-sheet" element={<Suspense fallback={<PageLoadingSkeleton />}><TradeSpecSheet /></Suspense>} />
                  <Route path="/trade" element={<Suspense fallback={null}><TradeErrorBoundary><TradeLayout /></TradeErrorBoundary></Suspense>}>
                    <Route index element={<TradeDashboard />} />
                    <Route path="admin" element={<TradeAdmin />} />
                    <Route path="admin-dashboard" element={<TradeAdminDashboard />} />
                    <Route path="registered-users" element={<TradeRegisteredUsers />} />
                    <Route path="description-writer" element={<TradeDescriptionWriter />} />
                    <Route path="gallery" element={<TradeGallery />} />
                    <Route path="quotes" element={<TradeQuotes />} />
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
                    <Route path="insights" element={<TradeInsights />} />
                    <Route path="downloads-by-country" element={<TradeDownloadsByCountry />} />
                    <Route path="designers" element={<TradeDesigners />} />
                    <Route path="designers/admin" element={<TradeDesignersAdmin />} />
                    <Route path="designers/instagram" element={<TradeInstagramAudit />} />
                    <Route path="designers/:slug" element={<TradeAtelierProfile />} />
                    <Route path="products/:slug/:productSlug" element={<TradeProductPage />} />
                    <Route path="boards" element={<TradeBoards />} />
                    <Route path="boards/:id" element={<TradeBoardBuilder />} />
                    {/* spec-sheet moved to public route */}
                    <Route path="audit-log" element={<TradeAuditLog />} />
                    <Route path="client-profiles" element={<TradeClientProfiles />} />
                    <Route path="order-timeline" element={<TradeOrderTimeline />} />
                    <Route path="ffe-schedule" element={<TradeFFESchedule />} />
                    <Route path="materials" element={<TradeMaterialLibrary />} />
                    <Route path="tearsheets" element={<TradeTearsheets />} />
                    <Route path="annotations" element={<TradeAnnotations />} />
                    <Route path="shipping-tracker" element={<TradeShippingTracker />} />
                    <Route path="shipping-estimator" element={<TradeShippingEstimator />} />
                    <Route path="admin/shipping-rates" element={<TradeAdminShippingRates />} />
                    <Route path="admin/shipping-surcharges" element={<TradeAdminShippingSurcharges />} />
                    <Route path="admin/taxonomy-audit" element={<TradeAdminTaxonomyAudit />} />
                    <Route path="mood-boards" element={<TradeMoodBoards />} />
                    <Route path="budget" element={<TradeBudgetTracker />} />
                    <Route path="lead-time-calendar" element={<TradeLeadTimeCalendar />} />
                    <Route path="reorder" element={<TradeReorder />} />
                    <Route path="currency-converter" element={<TradeCurrencyConverter />} />
                    <Route path="cpd" element={<TradeCPD />} />
                    <Route path="comparator" element={<TradeComparator />} />
                    <Route path="tools" element={<TradeTools />} />
                    <Route path="settings" element={<TradeSettings />} />
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
            </BrowserRouter>
          </QueryClientProvider>
        </CompareProvider>
        </AuthProvider>
      </LazyHelmetProvider>
    </Suspense>
  );
};

export default App;
