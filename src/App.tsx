import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

// Lazy-load non-landing pages and non-critical UI
const NotFound = lazy(() => import("./pages/NotFound"));
const FontPreview = lazy(() => import("./pages/FontPreview"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));

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
    <BrowserRouter>
      {MAINTENANCE_MODE ? (
        <Routes>
          <Route path="*" element={<Suspense fallback={null}><ComingSoon /></Suspense>} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/font-preview" element={<Suspense fallback={null}><FontPreview /></Suspense>} />
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
  );
};

export default App;
