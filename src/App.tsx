import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import usePageTracking from "./hooks/usePageTracking";

// Lazy-load pages and non-critical UI to reduce initial bundle
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));

const queryClient = new QueryClient();

// Set to false to disable maintenance mode and show the real site
const MAINTENANCE_MODE = false;

const PageTracker = () => {
  usePageTracking();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Suspense fallback={null}>
        <Toaster />
        <Sonner />
      </Suspense>
      <BrowserRouter>
        <PageTracker />
        {MAINTENANCE_MODE ? (
          <Routes>
            <Route path="*" element={<Suspense fallback={null}><ComingSoon /></Suspense>} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<Suspense fallback={null}><Index /></Suspense>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
          </Routes>
        )}
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
