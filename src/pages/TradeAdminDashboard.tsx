import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield, BarChart3, Newspaper, Award, Upload, DollarSign,
  FolderArchive, PenLine, Box, Presentation, Sparkles, History,
  AlertCircle, ChevronRight, Image, Package, Globe, Instagram,
  ClipboardList, Layers, Settings2, CalendarClock, Users, Truck, Percent, FileBox,
  Inbox,
} from "lucide-react";

interface AdminCard {
  title: string;
  description: string;
  url: string;
  icon: React.ElementType;
  badge?: number;
  superAdminOnly?: boolean;
}

const contentGroup: AdminCard[] = [
  { title: "Journal", description: "Manage articles, pipeline, and editorial content", url: "/trade/journal", icon: Newspaper },
  { title: "Designer Editor", description: "Edit designer profiles, bios, and imagery", url: "/trade/designers/admin", icon: PenLine },
  { title: "Provenance", description: "Certificates of authenticity and timelines", url: "/trade/provenance", icon: Award },
  { title: "Documents", description: "Upload and manage trade catalogues and spec sheets", url: "/trade/documents-admin", icon: Upload },
  { title: "Media Library", description: "Browse and manage uploaded assets", url: "/trade/media", icon: FolderArchive },
  { title: "Presentations", description: "Create and share client presentations", url: "/trade/presentations", icon: Presentation },
];

const commerceGroup: AdminCard[] = [
  { title: "Quote Management", description: "Review and respond to submitted trade quotes", url: "/trade/quotes-admin", icon: DollarSign },
  { title: "Order Timeline", description: "Kanban view of orders from deposit to delivery", url: "/trade/order-timeline", icon: CalendarClock },
  { title: "Sample Requests", description: "Track sample shipments and returns", url: "/trade/admin", icon: Package },
  { title: "Trade Applications", description: "Review and approve new trade registrations", url: "/trade/admin", icon: Shield },
  { title: "Registered Users", description: "View all sign-ups, roles, and application status", url: "/trade/registered-users", icon: Users },
  { title: "Custom Requests", description: "Concierge inbox — reply to bespoke requests inline", url: "/trade/custom-requests", icon: Inbox },
];

const analyticsGroup: AdminCard[] = [
  { title: "Insights", description: "Portal engagement, traffic, and usage analytics", url: "/trade/insights", icon: BarChart3 },
  { title: "Downloads by Country", description: "Track catalogue and spec sheet downloads per country", url: "/trade/downloads-by-country", icon: Globe },
  { title: "Client Profiles", description: "AI-powered taste profiles and engagement scores", url: "/trade/client-profiles", icon: Sparkles },
  { title: "Audit Log", description: "Track content changes and admin actions", url: "/trade/audit-log", icon: History },
];

const aiGroup: AdminCard[] = [
  { title: "Description Writer", description: "AI-generated product copy — editorial, technical, or SEO", url: "/trade/description-writer", icon: PenLine },
];

const systemGroup: AdminCard[] = [
  { title: "Axonometric Studio", description: "Manage 3D visualisation requests and gallery", url: "/trade/axonometric", icon: Box },
  { title: "Instagram Audit", description: "Map and verify all designer Instagram accounts", url: "/trade/designers/instagram", icon: Instagram },
  { title: "OG & Social Previews", description: "Re-scrape Open Graph metadata for social sharing", url: "/trade/admin", icon: Globe },
  { title: "Section Heroes", description: "Manage hero banner images across the portal", url: "/trade/admin", icon: Image },
  { title: "Taxonomy Audit", description: "Find curator picks with non-canonical or mismatched categories", url: "/trade/admin/taxonomy-audit", icon: Layers },
  { title: "Sync Status", description: "Compare Designer Editor vs trade products — flag mismatches", url: "/trade/admin/sync-status", icon: AlertCircle },
  { title: "CAD & 3D Assets", description: "Upload .dwg, .rfa, .skp files per product and per variant", url: "/trade/admin/cad-assets", icon: FileBox },
];

const shippingGroup: AdminCard[] = [
  { title: "Shipping Estimator", description: "Generate landed-cost quotes for trade users (Phase 1 TMS)", url: "/trade/shipping-estimator", icon: Truck },
  { title: "Shipping Rate Matrix", description: "Manage carrier lanes, rate brackets, and CSV imports", url: "/trade/admin/shipping-rates", icon: Settings2 },
  { title: "Shipping Surcharges", description: "Configure fuel, insurance, customs, and duty rates", url: "/trade/admin/shipping-surcharges", icon: Percent },
  { title: "Brand Lead Times", description: "Default availability + lead times per brand for stock badges", url: "/trade/admin/brand-lead-times", icon: Settings2 },
  { title: "Trade Tiers", description: "Edit Silver/Gold/Platinum discount % and 12-month spend thresholds", url: "/trade/admin/tiers", icon: Percent },
];

const groups = [
  { label: "Content & Editorial", items: contentGroup },
  { label: "Commerce & Operations", items: commerceGroup },
  { label: "Shipping & TMS (Phase 1)", items: shippingGroup },
  { label: "AI Content Studio", items: aiGroup },
  { label: "Analytics & Intelligence", items: analyticsGroup },
  { label: "System & Tools", items: systemGroup },
];

export default function TradeAdminDashboard() {
  const { isAdmin, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();

  // Fetch submitted quotes count for badge
  const { data: submittedCount = 0 } = useQuery({
    queryKey: ["admin-submitted-quotes"],
    queryFn: async () => {
      const { count } = await supabase
        .from("trade_quotes")
        .select("*", { count: "exact", head: true })
        .eq("status", "submitted");
      return count || 0;
    },
    enabled: isAdmin,
  });

  // Fetch pending applications count
  const { data: pendingApps = 0 } = useQuery({
    queryKey: ["admin-pending-apps"],
    queryFn: async () => {
      const { count } = await supabase
        .from("trade_applications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
    enabled: isAdmin,
  });

  // Fetch missing IG count
  const { data: missingIg = 0 } = useQuery({
    queryKey: ["ig-missing-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designers")
        .select("slug, links")
        .eq("is_published", true);
      if (!data) return 0;
      return data.filter((d) => {
        const links = d.links as any[] | null;
        if (!links || !Array.isArray(links)) return true;
        return !links.some((l: any) => l.type === "Instagram" || l.type === "instagram");
      }).length;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch open custom requests count (anything not resolved/closed)
  const { data: openCustomRequests = 0 } = useQuery({
    queryKey: ["admin-open-custom-requests"],
    queryFn: async () => {
      const { count } = await supabase
        .from("trade_custom_requests")
        .select("*", { count: "exact", head: true })
        .not("status", "in", "(resolved,closed,completed)");
      return count || 0;
    },
    enabled: isAdmin,
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  // Assign badges dynamically
  const getBadge = (title: string) => {
    if (title === "Quote Management") return submittedCount;
    if (title === "Trade Applications") return pendingApps;
    if (title === "Instagram Audit") return missingIg;
    if (title === "Custom Requests") return openCustomRequests;
    return 0;
  };

  return (
    <>
      <Helmet><title>Admin Dashboard — Trade Portal — Maison Affluency</title></Helmet>

      <div className="max-w-6xl space-y-10">
        <div>
          <h1 className="font-display text-2xl text-foreground">Admin Dashboard</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Manage content, operations, and system tools from a single hub.
          </p>
        </div>

        {groups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.superAdminOnly || isSuperAdmin
          );
          if (visibleItems.length === 0) return null;

          return (
            <section key={group.label}>
              <h2 className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
                {group.label}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleItems.map((card) => {
                  const badge = getBadge(card.title);
                  return (
                    <button
                      key={card.title}
                      onClick={() => navigate(card.url)}
                      className="group flex items-start gap-3 p-4 rounded-lg border border-border hover:border-foreground/30 bg-card text-left transition-all hover:shadow-sm"
                    >
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground/5 transition-colors">
                        <card.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm text-foreground">{card.title}</span>
                          {badge > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-medium leading-none">
                              <AlertCircle className="h-2.5 w-2.5" />
                              {badge}
                            </span>
                          )}
                        </div>
                        <p className="font-body text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {card.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground/60 shrink-0 mt-1 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
