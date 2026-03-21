import { lazy, Suspense, useState, useEffect } from "react";
import { LayoutDashboard } from "lucide-react";
import { Outlet, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TradeSidebar } from "@/components/trade/TradeSidebar";
import { TradeMobileMenu } from "@/components/trade/TradeMobileMenu";
import { NotificationBell } from "@/components/trade/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const CompareFab = lazy(() => import("@/components/CompareFab"));
const CompareDrawer = lazy(() => import("@/components/CompareDrawer"));
const TradeBottomNav = lazy(() => import("@/components/trade/TradeBottomNav"));

const TradeLayout = () => {
  const { user, loading, applicationStatus, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_quotes" }, () => fetchCount())
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
          <header className="h-14 md:h-14 flex items-center justify-between border-b border-border px-3 md:px-4 bg-background sticky top-0 z-10 print:hidden">
            <div className="flex items-center gap-2">
              {/* Mobile: full-screen burger menu */}
              <TradeMobileMenu
                open={mobileMenuOpen}
                onOpenChange={setMobileMenuOpen}
                submittedCount={submittedCount}
              />
              {/* Desktop: sidebar collapse trigger */}
              <SidebarTrigger className="hidden md:inline-flex mr-2 md:mr-3" />
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 md:h-[18px] md:w-[18px] text-muted-foreground" />
                <span className="font-display text-xs md:text-sm text-foreground uppercase tracking-[0.15em]">Trade Portal</span>
              </div>
            </div>
            <NotificationBell />
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-6 lg:pb-8">
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
      </Suspense>
    </SidebarProvider>
  );
};

export default TradeLayout;
