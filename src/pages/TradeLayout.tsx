import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { LayoutDashboard, ChevronUp } from "lucide-react";
import { Outlet, Navigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TradeSidebar } from "@/components/trade/TradeSidebar";
import { TradeMobileMenu } from "@/components/trade/TradeMobileMenu";
import { NotificationBell } from "@/components/trade/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import PriceModeSelector from "@/components/trade/PriceModeSelector";
import { GlobalProjectSwitcher } from "@/components/trade/GlobalProjectSwitcher";
import { StudioSwitcher } from "@/components/trade/StudioSwitcher";


import { ConciergeHeaderButton } from "@/components/trade/ConciergeHeaderButton";
import { MobilePreviewHeaderButton } from "@/components/trade/MobilePreviewHeaderButton";


const CompareFab = lazy(() => import("@/components/CompareFab"));
const CompareDrawer = lazy(() => import("@/components/CompareDrawer"));
const TradeBottomNav = lazy(() => import("@/components/trade/TradeBottomNav"));
const AIConcierge = lazy(() => import("@/components/trade/AIConcierge").then(m => ({ default: m.AIConcierge })));
const QuickTour = lazy(() => import("@/components/trade/QuickTour").then(m => ({ default: m.QuickTour })));
const BriefWizard = lazy(() => import("@/components/trade/BriefWizard").then(m => ({ default: m.BriefWizard })));

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
  "/trade/delivery-tracker": "Delivery Tracker",
  "/trade/materials": "Material Library",
  "/trade/tearsheets": "Tearsheet Builder",
  "/trade/annotations": "Markup & Annotation",
  "/trade/shipping-tracker": "Shipping Tracker",
  "/trade/mood-boards": "Mood Board",
  "/trade/budget": "Budget Tracker",
  "/trade/clients": "Clients",
  "/trade/lead-time-calendar": "Lead Time Calendar",
  "/trade/reorder": "Reorder",
  "/trade/currency-converter": "Currency Converter",
  "/trade/cpd": "CPD & Education",
  "/trade/comparator": "Product Comparator",
  "/trade/tools": "Tools",
};

const TRADE_GATE_COPY: Record<string, { title: string; description: string; h1: string }> = {
  "/trade": {
    title: "Trade Portal Dashboard | Maison Affluency",
    h1: "Maison Affluency Trade Portal",
    description: "Access project folders, trade pricing, spec sheets, quoting tools, FF&E schedules and white-label client documentation for interior design professionals.",
  },
  "/trade/dashboard": {
    title: "Trade Dashboard | Maison Affluency",
    h1: "Trade Dashboard",
    description: "Manage your projects, quotes, and client folders from the Maison Affluency trade dashboard.",
  },
  "/trade/designers": {
    title: "Trade Designers Directory | Maison Affluency",
    h1: "Trade Designers Directory",
    description: "Browse Maison Affluency designers and ateliers for trade projects, with materials, collections, spec sheets and project-folder tools available after sign-in.",
  },
  "/trade/gallery": {
    title: "Trade Gallery | Maison Affluency",
    h1: "Trade Gallery",
    description: "Explore the full trade product gallery with pricing, spec sheets and project-folder tools available to signed-in trade members.",
  },
  "/trade/quotes": {
    title: "Trade Quotes | Maison Affluency",
    h1: "Trade Quotes",
    description: "Build and manage trade quotes, pricing requests and client proposals. Sign in to access your quote history.",
  },
  "/trade/documents": {
    title: "Trade Documents | Maison Affluency",
    h1: "Trade Documents",
    description: "Access white-label client documentation, spec sheets and project exports. Sign in to view your trade documents.",
  },
  "/trade/showroom": {
    title: "Trade Showroom | Maison Affluency",
    h1: "Trade Showroom",
    description: "Browse curated showroom collections with trade pricing and project tools available after sign-in.",
  },
  "/trade/samples": {
    title: "Trade Samples | Maison Affluency",
    h1: "Trade Samples",
    description: "Request material and finish samples for your projects. Sign in to manage your sample orders.",
  },
  "/trade/favorites": {
    title: "Trade Favorites | Maison Affluency",
    h1: "Trade Favorites",
    description: "View your saved products and curated collections. Sign in to access your favorites and project folders.",
  },
  "/trade/projects": {
    title: "Trade Projects | Maison Affluency",
    h1: "Trade Projects",
    description: "Manage your client projects, FF&E schedules and order timelines. Sign in to view your project workspace.",
  },
  "/trade/boards": {
    title: "Project Folders | Maison Affluency",
    h1: "Project Folders",
    description: "Organize products into client project folders and share curated selections. Sign in to access your boards.",
  },
  "/trade/presentations": {
    title: "Trade Presentations | Maison Affluency",
    h1: "Trade Presentations",
    description: "Create and share white-label client presentations. Sign in to build and manage your trade presentations.",
  },
  "/trade/tearsheets": {
    title: "Tearsheet Builder | Maison Affluency",
    h1: "Tearsheet Builder",
    description: "Generate product tearsheets and spec exports for your projects. Sign in to access the tearsheet builder.",
  },
  "/trade/order-timeline": {
    title: "Order Timeline | Maison Affluency",
    h1: "Order Timeline",
    description: "Track order status, lead times and delivery schedules. Sign in to view your trade order timeline.",
  },
  "/trade/ffe-schedule": {
    title: "FF&E Schedule | Maison Affluency",
    h1: "FF&E Schedule",
    description: "Build and export FF&E schedules for your projects. Sign in to manage your fixtures, furnishings and equipment.",
  },
  "/trade/mood-boards": {
    title: "Mood Boards | Maison Affluency",
    h1: "Mood Boards",
    description: "Create visual mood boards and material palettes for client presentations. Sign in to access your mood boards.",
  },
  "/trade/clients": {
    title: "Client Address Book | Maison Affluency",
    h1: "Client Address Book",
    description: "Manage your client contacts and project associations. Sign in to access your trade client list.",
  },
  "/trade/media": {
    title: "Media Library | Maison Affluency",
    h1: "Media Library",
    description: "Browse and download high-resolution product images and CAD assets. Sign in to access the trade media library.",
  },
  "/trade/insights": {
    title: "Trade Insights | Maison Affluency",
    h1: "Trade Insights",
    description: "Explore market insights, provenance reports and design intelligence. Sign in for full trade insights access.",
  },
  "/trade/journal": {
    title: "Trade Journal | Maison Affluency",
    h1: "Trade Journal",
    description: "Read design stories, atelier profiles and industry features from the Maison Affluency editorial team.",
  },
  "/trade/provenance": {
    title: "Provenance | Maison Affluency",
    h1: "Provenance",
    description: "Discover the stories, craftsmanship and heritage behind Maison Affluency collections. Sign in for extended provenance data.",
  },
  "/trade/tools": {
    title: "Trade Tools | Maison Affluency",
    h1: "Trade Tools",
    description: "Access spatial fit audits, product comparators and other trade utilities. Sign in to use your trade tools.",
  },
  "/trade/currency-converter": {
    title: "Currency Converter | Maison Affluency",
    h1: "Currency Converter",
    description: "Convert trade pricing across currencies with real-time rates. Sign in to access the trade currency converter.",
  },
  "/trade/lead-time-calendar": {
    title: "Lead Time Calendar | Maison Affluency",
    h1: "Lead Time Calendar",
    description: "View production lead times and plan your project schedules. Sign in to access the trade lead time calendar.",
  },
  "/trade/materials": {
    title: "Material Library | Maison Affluency",
    h1: "Material Library",
    description: "Browse materials, finishes and swatches for your trade projects. Sign in to access the full material library.",
  },
  "/trade/shipping-tracker": {
    title: "Shipping Tracker | Maison Affluency",
    h1: "Shipping Tracker",
    description: "Track shipments and delivery status for your trade orders. Sign in to view your shipping tracker.",
  },
  "/trade/budget": {
    title: "Budget Tracker | Maison Affluency",
    h1: "Budget Tracker",
    description: "Monitor project budgets and spend across your trade orders. Sign in to access the budget tracker.",
  },
  "/trade/reorder": {
    title: "Reorder | Maison Affluency",
    h1: "Reorder",
    description: "Quickly reorder products from your trade history. Sign in to view and manage your reorders.",
  },
  "/trade/cpd": {
    title: "CPD & Education | Maison Affluency",
    h1: "CPD & Education",
    description: "Access continuing professional development resources for interior design professionals. Sign in for full CPD access.",
  },
  "/trade/comparator": {
    title: "Product Comparator | Maison Affluency",
    h1: "Product Comparator",
    description: "Compare products side-by-side with detailed specifications. Sign in to use the trade product comparator.",
  },
  "/trade/me": {
    title: "My Dashboard | Maison Affluency",
    h1: "My Dashboard",
    description: "View your account, saved items and activity. Sign in to access your personal trade dashboard.",
  },
};

function TradePublicGate({ path }: { path: string }) {
  const copy = TRADE_GATE_COPY[path] ?? TRADE_GATE_COPY["/trade"];
  const canonical = `https://maisonaffluency.com${path}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-16">
      <Helmet>
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={copy.title} />
        <meta property="og:description" content={copy.description} />
        <meta property="og:url" content={canonical} />
      </Helmet>
      <main className="w-full max-w-2xl text-center space-y-6">
        <Link to="/" className="font-display text-sm uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors">
          Maison Affluency
        </Link>
        <div className="space-y-3">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">Trade Access</p>
          <h1 className="font-display text-3xl md:text-5xl text-foreground tracking-wide">{copy.h1}</h1>
          <p className="font-body text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">{copy.description}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/trade/login" className="w-full sm:w-auto px-7 py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.16em] rounded-full hover:opacity-90 transition-opacity">
            Sign in
          </Link>
          <Link to="/trade/register" className="w-full sm:w-auto px-7 py-3 border border-border font-body text-xs uppercase tracking-[0.16em] rounded-full hover:bg-muted transition-colors">
            Apply for access
          </Link>
        </div>
      </main>
    </div>
  );
}

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
          className="fixed bottom-36 md:bottom-20 right-4 z-[90] w-10 h-10 flex items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:opacity-80 transition-opacity"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

const TradeLayout = () => {
  const { user, loading, applicationStatus, isAdmin, isTradeUser, profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const location = useLocation();

  // Strip a bare trailing "#" left in the URL by in-page anchor scrolls.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "" && window.location.href.endsWith("#")) {
      const clean = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", clean);
    }
  }, [location.pathname, location.search, location.hash]);


  const pageTitle = useMemo(() => {
    const path = location.pathname;
    // Exact match first
    if (ROUTE_TITLES[path]) return ROUTE_TITLES[path];
    // Try parent path for nested routes like /trade/designers/ecart
    const parentPath = path.split("/").slice(0, 3).join("/");
    return ROUTE_TITLES[parentPath] || "Trade Portal";
  }, [location.pathname]);

  // Remember last viewed trade section (excluding the dashboard itself) for personalised welcome copy
  useEffect(() => {
    const path = location.pathname;
    if (path === "/trade" || path === "/trade/") return;
    const parentPath = path.split("/").slice(0, 3).join("/");
    const label = ROUTE_TITLES[path] || ROUTE_TITLES[parentPath];
    if (label) {
      try {
        localStorage.setItem("trade_last_section", JSON.stringify({ path: parentPath, label }));
      } catch {}
    }
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
        <DotCircleLoader size="md" />
      </div>
    );
  }

  if (!user) {
    const publicGatePath = location.pathname.replace(/\/$/, "") || "/trade";
    if (TRADE_GATE_COPY[publicGatePath]) return <TradePublicGate path={publicGatePath} />;
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

  // Public registered users (no trade role, no admin, no application) are confined
  // to their own dashboard at /trade/me. Block all other /trade/* routes.
  if (!isAdmin && !isTradeUser && applicationStatus === "none") {
    const path = location.pathname.replace(/\/$/, "");
    const PUBLIC_ALLOWED = ["/trade/me", "/trade/settings"];
    if (!PUBLIC_ALLOWED.includes(path)) {
      return <Navigate to="/trade/me?restricted=1" replace />;
    }
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar — desktop only */}
        <div className="hidden md:block" data-trade-sidebar>
          <TradeSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <header className={`h-14 md:h-14 ${/^\/trade\/products\//.test(location.pathname) ? "hidden md:flex" : "flex"} items-center border-b border-border px-3 md:px-4 bg-background sticky top-0 z-10 print:hidden relative pt-[env(safe-area-inset-top)]`}>
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
            {/* Mobile: centered Trade Portal label removed to avoid overlap with studio switcher */}
            {/* Right: project switcher + trade price toggle + notification bell */}
            <div className="ml-auto flex items-center gap-2 md:gap-4">
              <StudioSwitcher />
              <GlobalProjectSwitcher />
              <div className="hidden sm:block">
                <PriceModeSelector />
              </div>
              <NotificationBell />
              <MobilePreviewHeaderButton />
              <ConciergeHeaderButton />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-6 lg:pb-8">
            
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <DotCircleLoader size="sm" className="text-muted-foreground" />
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
        <QuickTour />
        <BriefWizard />
        <BackToTopButton />
      </Suspense>
    </SidebarProvider>
  );
};

export default TradeLayout;
