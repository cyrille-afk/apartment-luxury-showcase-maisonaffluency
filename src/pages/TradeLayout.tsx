import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { LayoutDashboard, ChevronUp } from "lucide-react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TradeSidebar } from "@/components/trade/TradeSidebar";
import { TradeMobileMenu } from "@/components/trade/TradeMobileMenu";
import { NotificationBell } from "@/components/trade/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import TradePriceToggle from "@/components/trade/TradePriceToggle";
import { GlobalProjectSwitcher } from "@/components/trade/GlobalProjectSwitcher";
import { StudioSwitcher } from "@/components/trade/StudioSwitcher";
import { OrphanAssignBanner } from "@/components/trade/OrphanAssignBanner";
import { TierBadge } from "@/components/trade/TierBadge";

const CompareFab = lazy(() => import("@/components/CompareFab"));
const CompareDrawer = lazy(() => import("@/components/CompareDrawer"));
const TradeBottomNav = lazy(() => import("@/components/trade/TradeBottomNav"));
const AIConcierge = lazy(() => import("@/components/trade/AIConcierge").then(m => ({ default: m.AIConcierge })));

const ROUTE_TITLES: Record<string, string> = {
  "/trade": "Dashboard",
  "/trade/showroom": "Showroom",
  "/trade/favorites": "Favorites",
  "/trade/gallery": "Gallery",
  "/trade/quotes": "Quotes",
  "/trade/designers": "Designers",
  "/trade/documents": "Documents",
  "/trade/samples": "Samples",
  "/trade/settings": "Settings",
  "/trade/journal": "Journal",
  "/trade/insights": "Insights",
  "/trade/provenance": "Provenance",
  "/trade/presentations": "Presentations",
  "/trade/boards": "Project Folders",
  "/trade/projects": "Projects",
  "/trade/media": "Media Library",
  "/trade/admin-dashboard": "Admin Dashboard",
  "/trade/order-timeline": "Order Timeline",
  "/trade/ffe-schedule": "FF&E Schedule",
  "/trade/materials": "Material Library",
  "/trade/tearsheets": "Tearsheet Builder",
  "/trade/annotations": "Markup & Annotation",
  "/trade/shipping-tracker": "Shipping Tracker",
  "/trade/mood-boards": "Mood Board",
  "/trade/budget": "Budget Tracker",
  "/trade/lead-time-calendar": "Lead Time Calendar",
  "/trade/reorder": "Reorder",
  "/trade/currency-converter": "Currency Converter",
  "/trade/cpd": "CPD & Education",
  "/trade/comparator": "Product Comparator",
  "/trade/tools": "Tools",
};

function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-to-top"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-20 md:bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:opacity-80 transition-opacity"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

const TradeLayout = () => {
  const { user, loading, applicationStatus, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const location = useLocation();

  const pageTitle = useMemo(() => {
    const path = location.pathname;
    // Exact match first
    if (ROUTE_TITLES[path]) return ROUTE_TITLES[path];
    // Try parent path for nested routes like /trade/designers/ecart
    const parentPath = path.split("/").slice(0, 3).join("/");
    return ROUTE_TITLES[parentPath] || "Trade Portal";
  }, [location.pathname]);

  // Fetch submitted quotes count for admin badge (shared between sidebar & mobile menu)
  useEffect(() => {
    if (!isAdmin) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("trade_quotes")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted");
      setSubmittedCount(count || 0);
    };
    fetchCount();
    const channel = supabase
      .channel("trade-quotes-badge-layout")
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_quotes", filter: "status=eq.submitted" }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/trade/login" replace />;
  }

  // Admins bypass application status checks
  if (!isAdmin && applicationStatus === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="font-display text-2xl text-foreground mb-4">Application Under Review</h1>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Thank you for applying. Our team is reviewing your trade application and will get back to you within 1-2 business days.
          </p>
          <p className="font-body text-xs text-muted-foreground">
            Questions? Contact us at{" "}
            <a href="mailto:concierge@myaffluency.com" className="underline underline-offset-4">
              concierge@myaffluency.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin && applicationStatus === "rejected") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="font-display text-2xl text-foreground mb-4">Application Not Approved</h1>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Unfortunately, your trade application was not approved at this time. Please contact us for more information.
          </p>
          <a href="mailto:concierge@myaffluency.com" className="font-body text-sm text-foreground underline underline-offset-4">
            concierge@myaffluency.com
          </a>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar — desktop only */}
        <div className="hidden md:block" data-trade-sidebar>
          <TradeSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 md:h-14 flex items-center border-b border-border px-3 md:px-4 bg-background sticky top-0 z-10 print:hidden relative">
            {/* Mobile: burger left */}
            <div className="flex items-center gap-2 md:flex-1">
              <TradeMobileMenu
                open={mobileMenuOpen}
                onOpenChange={setMobileMenuOpen}
                submittedCount={submittedCount}
              />
              {/* Desktop: sidebar collapse trigger */}
              <SidebarTrigger className="hidden md:inline-flex mr-2 md:mr-3" />
              {/* Desktop: Trade Portal branding */}
              <div className="hidden md:flex items-center gap-2">
                <LayoutDashboard className="h-[18px] w-[18px] text-muted-foreground" />
                <span className="font-display text-sm text-foreground uppercase tracking-[0.15em]">Trade Portal</span>
              </div>
            </div>
            {/* Mobile: centered Trade Portal */}
            <div className="absolute left-1/2 -translate-x-1/2 md:hidden flex items-center gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-display text-xs text-foreground uppercase tracking-[0.15em]">Trade Portal</span>
            </div>
            {/* Right: project switcher + trade price toggle + notification bell */}
            <div className="ml-auto flex items-center gap-2 md:gap-4">
              <StudioSwitcher />
              <GlobalProjectSwitcher />
              <div className="hidden md:block">
                <TierBadge showDiscount />
              </div>
              <div className="hidden sm:block">
                <TradePriceToggle />
              </div>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-6 lg:pb-8">
            <OrphanAssignBanner />
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </main>
          <Suspense fallback={null}>
            <TradeBottomNav />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={null}>
        <CompareFab />
        <CompareDrawer />
        <AIConcierge />
        <BackToTopButton />
      </Suspense>
    </SidebarProvider>
  );
};

export default TradeLayout;
