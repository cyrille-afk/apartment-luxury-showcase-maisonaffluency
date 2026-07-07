import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, FileBox, Inbox, Instagram, MapPin, Sparkles, Tags } from "lucide-react";
import TaxonomyAudit from "@/components/trade/TaxonomyAudit";
import HeroManager from "@/components/trade/HeroManager";
import SampleRequestsAdmin from "@/components/trade/SampleRequestsAdmin";
import ScrapeProducts from "@/components/trade/ScrapeProducts";
import InstagramFeedAdmin from "@/components/trade/InstagramFeedAdmin";
import OgRescrapeAdmin from "@/components/trade/OgRescrapeAdmin";
import InstagramAuditCard from "@/components/admin/InstagramAuditCard";

/**
 * Miscellaneous admin tools that used to live at the bottom of /trade/admin.
 * Kept as a separate route so /trade/admin is focused on Trade Applications
 * and Price-on-Request submissions.
 */
export default function TradeAdminTools() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Admin Tools — Trade Portal — Maison Affluency</title></Helmet>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Admin Tools</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Content, catalog, and system utilities.
          </p>
        </div>

        {/* Concierge Leads */}
        <Link
          to="/trade/admin/concierge-leads"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
        >
          <Inbox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="flex-1">
            <span className="font-display text-sm text-foreground">Concierge Leads</span>
            <p className="font-body text-[10px] text-muted-foreground">Browse and filter AI-captured lead intake from public and trade concierge</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>

        <InstagramAuditCard />

        <Link
          to="/trade/admin/cad-assets"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
        >
          <FileBox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="flex-1">
            <span className="font-display text-sm text-foreground">CAD &amp; 3D Assets</span>
            <p className="font-body text-[10px] text-muted-foreground">Upload .dwg, .rfa, .skp files per product and variant for trade users</p>
          </div>
        </Link>

        <Link
          to="/trade/admin/glb-models"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
        >
          <FileBox className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="flex-1">
            <span className="font-display text-sm text-foreground">3D Models (GLB)</span>
            <p className="font-body text-[10px] text-muted-foreground">Upload a .glb/.gltf to a product — auto-saves the URL and shows the interactive viewer on the trade page</p>
          </div>
        </Link>

        <Link
          to="/trade/admin/hotspot-mapping"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
        >
          <MapPin className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="flex-1">
            <span className="font-display text-sm text-foreground">Hotspot → Catalog Mapping</span>
            <p className="font-body text-[10px] text-muted-foreground">Bulk-assign exact catalog picks to gallery hotspots and override the View Product fuzzy matcher</p>
          </div>
        </Link>

        <Link
          to="/trade/admin/onboarding"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
        >
          <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="flex-1">
            <span className="font-display text-sm text-foreground">First-login flow</span>
            <p className="font-body text-[10px] text-muted-foreground">Edit the welcome panel, Quick Tour steps, and replay onboarding for any user</p>
          </div>
        </Link>

        <Link
          to="/trade/admin/onboarding-funnel"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:border-foreground/30 transition-all group"
        >
          <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="flex-1">
            <span className="font-display text-sm text-foreground">Onboarding funnel</span>
            <p className="font-body text-[10px] text-muted-foreground">Step views, sub-step clicks, completes and skips — filterable by device</p>
          </div>
        </Link>

        <InstagramFeedAdmin />

        <TaxonomyAudit />

        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 group cursor-pointer">
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            <h2 className="font-display text-lg text-foreground">Section Hero Images</h2>
          </CollapsibleTrigger>
          <p className="font-body text-xs text-muted-foreground ml-6">Upload custom hero banners for trade portal sections. Remove to revert to defaults.</p>
          <CollapsibleContent className="mt-3">
            <HeroManager />
          </CollapsibleContent>
        </Collapsible>

        <ScrapeProducts />

        <OgRescrapeAdmin />

        <SampleRequestsAdmin />
      </div>
    </>
  );
}
