import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "./pages/Index";
import { CompareProvider } from "@/contexts/CompareContext";
import { AuthProvider } from "@/hooks/useAuth";

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
const TradeGallery = lazy(() => import("./pages/TradeGallery"));
const TradeDocuments = lazy(() => import("./pages/TradeDocuments"));
const TradeQuotes = lazy(() => import("./pages/TradeQuotes"));
const TradeSettings = lazy(() => import("./pages/TradeSettings"));
const TradeShowroom = lazy(() => import("./pages/TradeShowroom"));
const TradeSamples = lazy(() => import("./pages/TradeSamples"));
const TradeJournal = lazy(() => import("./pages/TradeJournal"));
const TradeProvenance = lazy(() => import("./pages/TradeProvenance"));
const TradeDocumentsAdmin = lazy(() => import("./pages/TradeDocumentsAdmin"));
const TradeMediaLibrary = lazy(() => import("./pages/TradeMediaLibrary"));
const TradeQuotesAdmin = lazy(() => import("./pages/TradeQuotesAdmin"));
const TradeAxonometric = lazy(() => import("./pages/TradeAxonometric"));
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
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Journal = lazy(() => import("./pages/Journal"));
const JournalArticle = lazy(() => import("./pages/JournalArticle"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

// Defer heavy providers + toast UI — not needed for hero/LCP
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));

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
    const win = window as any;

    if (typeof win.requestIdleCallback === "function") {
      const idleId = win.requestIdleCallback(() => setShowDeferredUi(true), { timeout: 1500 });
      return () => win.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(() => setShowDeferredUi(true), 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <HelmetProvider>
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

                  {/* Trade Portal */}
                  <Route path="/trade/login" element={<Suspense fallback={null}><TradeLogin /></Suspense>} />
                  <Route path="/trade/program" element={<Suspense fallback={null}><TradeLanding /></Suspense>} />
                  <Route path="/trade/register" element={<Suspense fallback={null}><TradeRegister /></Suspense>} />
                  <Route path="/reset-password" element={<Suspense fallback={null}><ResetPassword /></Suspense>} />
                  <Route path="/board/:token" element={<Suspense fallback={null}><ClientBoardViewer /></Suspense>} />
                  <Route path="/journal" element={<Suspense fallback={null}><Journal /></Suspense>} />
                  <Route path="/journal/:slug" element={<Suspense fallback={null}><JournalArticle /></Suspense>} />
                  <Route path="/trade" element={<Suspense fallback={null}><TradeErrorBoundary><TradeLayout /></TradeErrorBoundary></Suspense>}>
                    <Route index element={<TradeDashboard />} />
                    <Route path="admin" element={<TradeAdmin />} />
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
                    <Route path="settings" element={<TradeSettings />} />
                  </Route>

                  <Route path="/privacy" element={<Suspense fallback={null}><PrivacyPolicy /></Suspense>} />
                  <Route path="/terms" element={<Suspense fallback={null}><TermsOfService /></Suspense>} />
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
                  </TooltipProvider>
                </Suspense>
              )}
            </BrowserRouter>
          </QueryClientProvider>
        </CompareProvider>
      </AuthProvider>
    </HelmetProvider>
  );
};

export default App;
