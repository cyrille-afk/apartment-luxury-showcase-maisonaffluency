import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { CompareProvider } from "@/contexts/CompareContext";
import { AuthProvider } from "@/hooks/useAuth";

// Lazy-load non-landing pages and non-critical UI
const NotFound = lazy(() => import("./pages/NotFound"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));

// Trade portal pages
const TradeLogin = lazy(() => import("./pages/TradeLogin"));
const TradeRegister = lazy(() => import("./pages/TradeRegister"));
const TradeLayout = lazy(() => import("./pages/TradeLayout"));
const TradeDashboard = lazy(() => import("./pages/TradeDashboard"));
const TradeAdmin = lazy(() => import("./pages/TradeAdmin"));
const TradeGallery = lazy(() => import("./pages/TradeGallery"));
const TradeDocuments = lazy(() => import("./pages/TradeDocuments"));
const TradeQuotes = lazy(() => import("./pages/TradeQuotes"));
const TradeSettings = lazy(() => import("./pages/TradeSettings"));
const TradeShowroom = lazy(() => import("./pages/TradeShowroom"));

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

// Lazy-load QueryClientProvider so @tanstack/react-query isn't in the critical bundle
const LazyQueryProvider = lazy(() =>
  import("@tanstack/react-query").then(m => {
    const qc = new m.QueryClient();
    const Provider = ({ children }: { children: React.ReactNode }) => (
      <m.QueryClientProvider client={qc}>{children}</m.QueryClientProvider>
    );
    return { default: Provider };
  })
);

const App = () => {
  const [showDeferredUi, setShowDeferredUi] = useState(false);

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
    <AuthProvider>
    <CompareProvider>
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
          <Route path="/trade/register" element={<Suspense fallback={null}><TradeRegister /></Suspense>} />
          <Route path="/trade" element={<Suspense fallback={null}><TradeLayout /></Suspense>}>
            <Route index element={<TradeDashboard />} />
            <Route path="admin" element={<TradeAdmin />} />
            <Route path="gallery" element={<TradeGallery />} />
            <Route path="quotes" element={<TradeQuotes />} />
            <Route path="documents" element={<TradeDocuments />} />
            <Route path="settings" element={<TradeSettings />} />
          </Route>
          
          <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
        </Routes>
      )}

      {/* Deferred UI: providers + toasts mount after hero is painted */}
      {showDeferredUi && (
        <Suspense fallback={null}>
          <LazyQueryProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PageTracker />
            </TooltipProvider>
          </LazyQueryProvider>
        </Suspense>
      )}
    </BrowserRouter>
    </CompareProvider>
    </AuthProvider>
  );
};

export default App;
