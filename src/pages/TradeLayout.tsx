import { Outlet, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TradeSidebar } from "@/components/trade/TradeSidebar";
import { useAuth } from "@/hooks/useAuth";

const TradeLayout = () => {
  const { user, loading, applicationStatus, isAdmin } = useAuth();

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
      <Helmet>
        <meta name="pinterest" content="nopin" />
      </Helmet>
      <div className="min-h-screen flex w-full bg-background">
        <div data-trade-sidebar><TradeSidebar /></div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 md:h-14 flex items-center border-b border-border px-3 md:px-4 bg-background sticky top-0 z-10 print:hidden">
            <SidebarTrigger className="mr-3 md:mr-4" />
            <span className="font-body text-[10px] md:text-xs text-muted-foreground uppercase tracking-[0.15em]">Trade Portal</span>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default TradeLayout;
