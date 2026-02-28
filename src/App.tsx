import { lazy, Suspense, useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

// Lazy-load non-landing pages and non-critical UI
const NotFound = lazy(() => import("./pages/NotFound"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));

// Defer non-LCP-critical components
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));

const queryClient = new QueryClient();

// Set to false to disable maintenance mode and show the real site
const MAINTENANCE_MODE = false;

const PageTracker = lazy(() => import("./hooks/usePageTracking").then(m => {
  const Tracker = () => { m.default(); return null; };
  return { default: Tracker };
}));

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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {showDeferredUi && (
          <Suspense fallback={null}>
            <Toaster />
            <Sonner />
          </Suspense>
        )}
        <BrowserRouter>
          {showDeferredUi && (
            <Suspense fallback={null}>
              <PageTracker />
            </Suspense>
          )}
          {MAINTENANCE_MODE ? (
            <Routes>
              <Route path="*" element={<Suspense fallback={null}><ComingSoon /></Suspense>} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
            </Routes>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
