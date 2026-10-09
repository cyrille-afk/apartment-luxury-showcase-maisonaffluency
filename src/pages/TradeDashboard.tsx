import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Image, FileText, FolderOpen, FolderClosed,
  Clock, FileDown, MapPin, Box, Users, Sparkles, Clapperboard, Play,
} from "lucide-react";
import { startFelixTour } from "@/components/trade/FelixTour";
import { WhiteLabelTourBanner } from "@/components/trade/WhiteLabelTourBanner";
import { ActivityRowSkeleton, BrandFolderSkeleton } from "@/components/trade/skeletons";
import { MostPopularProducts } from "@/components/trade/MostPopularProducts";
import { NewInquiriesAlert } from "@/components/trade/NewInquiriesAlert";
import { BoardRecommendations } from "@/components/trade/BoardRecommendations";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadName, DEFAULT_NAME } from "@/components/trade/conciergeGreeting";
import { useAIGuideName } from "@/hooks/useAIGuideName";
import { useProjects } from "@/hooks/useProjects";
import { useDashboardDataSync } from "@/hooks/useDashboardDataSync";
import { projectDefaultUrl, useProjectBoardTree } from "@/hooks/useProjectBoardTree";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { useTierVolumeLocale } from "@/hooks/useTierVolumeLocale";
import { useStudio } from "@/hooks/useStudio";
import { isSampleProject } from "@/lib/onboardingProject";
import { Button } from "@/components/ui/button";
import { DashboardPwaBanner } from "@/components/trade/PwaInstall";
import dashboard3dStudioImage from "@/assets/dashboard-3d-style-neutrals.jpg";
import dashboardWalkthroughImage from "@/assets/studio-after-render.jpg";

interface BrandFolder {
  brand_name: string;
  doc_count: number;
}

interface ActivityItem {
  id: string;
  type: "document" | "quote";
  title: string;
  subtitle: string;
  date: string;
  link?: string;
}

const thumb = (id: string, gravity?: string) =>
  cloudinaryUrl(id, { width: 600, height: 400, quality: "auto", crop: "fill", gravity: (gravity as any) || "auto" });

// Dashboard card definitions – each has a section_heroes key for admin overrides
const DASH_CARDS = [
  { key: "dash-showroom", title: "Curated Showroom", description: "Hand-picked pieces staged in our Singapore gallery", icon: MapPin, to: "/trade/the-collection", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,c_fill,q_auto:good,f_auto/v1/living-room-hero_zxfcxl", defaultGravity: "center" },
  { key: "dash-gallery", title: "Full Catalogue", description: "Browse the complete collection with trade pricing", icon: Image, to: "/trade/gallery", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/v1773811405/IMG_6996_tfx4bp.jpg", defaultGravity: "south" },
  { key: "dash-library", title: "Resources", description: "Access catalogues, inventory & spec sheets", icon: FolderOpen, to: "/trade/documents", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_400,c_fill,g_auto,q_auto,f_auto/v1774172614/2.-Digital-Resources_qbsqxs.jpg", defaultGravity: "auto" },
  { key: "dash-designers", title: "Designers & Ateliers Library", description: "Discover 32 ateliers and 274 designers", icon: Users, to: "/trade/designers", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_400,c_fill,g_auto,q_auto,f_auto/v1773838925/1_6Jp3vJWe7VFlFHZ9WhSJng_u6ai93.jpg", defaultGravity: "auto" },
  { key: "dash-quotes", title: "Quote Builder", description: "Create branded quotes for your clients", icon: FileText, to: "/trade/quotes", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/e_contrast:20,e_saturation:15/v1773799140/Screen_Shot_2026-03-18_at_9.57.16_AM_mpvvpg.png", defaultGravity: "auto" },
  { key: "dash-3d-studio", title: "3D Studio", description: "Submit drawings for 3D renders & browse gallery", icon: Box, to: "/trade/axonometric-requests", fallbackId: null as string | null, fallbackImage: dashboard3dStudioImage as string | null, defaultGravity: "auto" },
  { key: "dash-ai-walkthrough", title: "3D Room Layout & Walkthrough", description: "Furnish a room from your brief, then render a cinematic walkthrough", icon: Clapperboard, to: "/trade/ai-layout", fallbackId: null as string | null, fallbackImage: dashboardWalkthroughImage as string | null, defaultGravity: "center" },
];

// Hover/focus preview of the member's latest completed walkthrough render,
// layered over the dashboard card image. RLS scopes video_render_jobs to the
// signed-in user, so this only ever surfaces their own renders.
function WalkthroughCardPreview() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Members can pin a render from the AI layout history; otherwise use the latest.
      let chosenId: string | null = null;
      try { chosenId = localStorage.getItem("ma-dashboard-walkthrough-preview"); } catch { /* ignore */ }
      let query = supabase
        .from("video_render_jobs")
        .select("video_url")
        .eq("state", "completed")
        .not("video_url", "is", null);
      if (chosenId) {
        query = query.eq("job_id", chosenId).limit(1);
      } else {
        query = query.order("created_at", { ascending: false }).limit(1);
      }
      let { data } = await query;
      // Pinned render missing or no longer completed — fall back to the latest.
      if (chosenId && (!data || data.length === 0)) {
        ({ data } = await supabase
          .from("video_render_jobs")
          .select("video_url")
          .eq("state", "completed")
          .not("video_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(1));
      }
      if (!cancelled && data && data.length > 0 && data[0].video_url) {
        setVideoUrl(data[0].video_url);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!videoUrl) return null;

  return (
    <>
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Preview of your latest walkthrough render, shown when you hover over or tab to this card"
        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
        onMouseEnter={(e) => { void e.currentTarget.play().catch(() => undefined); }}
        onMouseLeave={(e) => { e.currentTarget.pause(); }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-1.5 bg-background/90 px-2 py-1 font-body text-[9px] uppercase tracking-[0.15em] text-muted-foreground transition-opacity duration-300 [@media(hover:none)]:hidden group-hover:opacity-0 group-focus-visible:opacity-0 sm:inline-flex"
      >
        <Play className="h-2.5 w-2.5" />
        Hover to preview
      </span>
    </>
  );
}

const GRAVITY_TO_POSITION: Record<string, string> = {
  east: "object-right",
  west: "object-left",
  north: "object-top",
  south: "object-bottom",
  center: "object-center",
  auto: "",
};

const typeLabels: Record<string, string> = {
  tearsheet: "Tearsheet",
  catalogue: "Catalogue",
  pricelist: "Price List",
  specification: "Specification",
};

const formatRelativeDate = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// Warm the galleries chunk so Step 2 → Step 3 swaps instantly.
if (typeof window !== "undefined") { setTimeout(() => { void import("./TradeShowroom"); }, 1500); }

const TradeDashboard = () => {
  const guideName = useAIGuideName();
  const { profile, user } = useAuth();
  const { canEdit } = useStudio();
  const [firstWelcome, setFirstWelcome] = useState(() => {
    try {
      return document.documentElement.dataset.felixTourActive === "true" || !localStorage.getItem("felix_dashboard_tour_seen_v1");
    } catch { return true; }
  });
  useEffect(() => {
    const syncWelcome = () => {
      try {
        setFirstWelcome(document.documentElement.dataset.felixTourActive === "true" || !localStorage.getItem("felix_dashboard_tour_seen_v1"));
      } catch { setFirstWelcome(true); }
    };
    window.addEventListener("felix-tour:state", syncWelcome);
    window.addEventListener("storage", syncWelcome);
    return () => {
      window.removeEventListener("felix-tour:state", syncWelcome);
      window.removeEventListener("storage", syncWelcome);
    };
  }, []);
  const { tier, tierLabel, config: tierConfig } = useTradeDiscount();
  const { showTradePrice } = useTradePriceMode();
  const tierVolume = useTierVolumeLocale();
  const { projects: activeProjects } = useProjects({ activeOnly: true });
  const syncedItemsByProject = useDashboardDataSync();
  const projectBoards = useProjectBoardTree(activeProjects.map((project) => project.id));
  const [searchParams, setSearchParams] = useSearchParams();
  const [brands, setBrands] = useState<BrandFolder[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroOverrides, setHeroOverrides] = useState<Record<string, { image_url: string; gravity: string }>>({});
  const [studioStats, setStudioStats] = useState<{ count: number; latestImage: string | null }>({ count: 0, latestImage: null });
  const [spendCents, setSpendCents] = useState<number | null>(null);

  // Rolling 12-month confirmed spend drives the tier volume tracker.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("trade_tier_12mo_spend_cents")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setSpendCents(((data as any)?.trade_tier_12mo_spend_cents as number | null) ?? 0);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Arriving from /trade-onboarding ("Enter Workspace") — confirm the copilot
  // is live with a single non-intrusive toast at the base of the sidebar.
  useEffect(() => {
    if (searchParams.get("onboarded") !== "1") return;
    const name = loadName() || DEFAULT_NAME;
    toast.success(`${name} is fully initialized and active in your studio workspace.`, {
      position: "bottom-left",
    });
    searchParams.delete("onboarded");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch dashboard hero overrides
      const { data: heroes } = await supabase
        .from("section_heroes")
        .select("section_key, image_url, gravity")
        .like("section_key", "dash-%");
      if (heroes) {
        const map: Record<string, { image_url: string; gravity: string }> = {};
        heroes.forEach((h: any) => { map[h.section_key] = { image_url: h.image_url, gravity: h.gravity }; });
        setHeroOverrides(map);
      }

      // Fetch brands
      const { data: docs } = await supabase
        .from("trade_documents")
        .select("brand_name");
      const countMap = new Map<string, number>();
      if (docs) {
        for (const row of docs) {
          countMap.set(row.brand_name, (countMap.get(row.brand_name) || 0) + 1);
        }
      }
      const { data: products } = await supabase
        .from("trade_products")
        .select("brand_name");
      if (products) {
        for (const p of products) {
          if (!countMap.has(p.brand_name)) countMap.set(p.brand_name, 0);
        }
      }
      setBrands(
        [...countMap.entries()]
          .map(([brand_name, doc_count]) => ({ brand_name, doc_count }))
          .sort((a, b) => a.brand_name.localeCompare(b.brand_name))
      );

      // Fetch recent activity: latest documents + user's quotes
      const items: ActivityItem[] = [];

      const { data: recentDocs } = await supabase
        .from("trade_documents")
        .select("id, title, brand_name, document_type, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (recentDocs) {
        for (const d of recentDocs) {
          items.push({
            id: `doc-${d.id}`,
            type: "document",
            title: d.title,
            subtitle: `${d.brand_name} · ${typeLabels[d.document_type] || d.document_type}`,
            date: d.created_at,
            link: `/trade/documents?brand=${encodeURIComponent(d.brand_name)}`,
          });
        }
      }

      const { data: recentQuotes } = await supabase
        .from("trade_quotes")
        .select("id, client_name, status, updated_at, currency")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (recentQuotes) {
        for (const q of recentQuotes) {
          items.push({
            id: `quote-${q.id}`,
            type: "quote",
            title: q.client_name || "Untitled Quote",
            subtitle: `${q.status.charAt(0).toUpperCase() + q.status.slice(1)} · ${q.currency}`,
            date: q.updated_at,
            link: `/trade/quotes`,
          });
        }
      }

      // Sort all activity by date descending, take top 8
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivity(items.slice(0, 8));

      // Fetch 3D Studio gallery stats
      const { count: galleryCount } = await (supabase as any)
        .from("axonometric_gallery")
        .select("*", { count: "exact", head: true })
        .eq("is_published", true);
      const { data: latestRender } = await (supabase as any)
        .from("axonometric_gallery")
        .select("image_url")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1);
      setStudioStats({
        count: galleryCount || 0,
        latestImage: latestRender?.[0]?.image_url || null,
      });

      setLoading(false);
    };
    fetchData();
  }, []);

  const getCardImage = (card: typeof DASH_CARDS[number]) => {
    const override = heroOverrides[card.key];
    if (override) return override.image_url;
    // 3D Studio: editorial brand fallback. Latest render surfaced inside the page.
    if (card.key === "dash-3d-studio") return dashboard3dStudioImage;
    if (card.fallbackImage) return card.fallbackImage;
    if (card.fallbackId) return thumb(card.fallbackId);
    return "";
  };

  const getCardPosition = (card: typeof DASH_CARDS[number]) => {
    const override = heroOverrides[card.key];
    const gravity = override ? override.gravity : card.defaultGravity;
    return GRAVITY_TO_POSITION[gravity] || "";
  };

  return (
    <>
      <Helmet><title>Dashboard — Trade Portal — Maison Affluency</title></Helmet>
    <div className="trade-dashboard w-full max-w-[1500px] mx-auto">
      <NewInquiriesAlert />
      <WhiteLabelTourBanner />
      <DashboardPwaBanner />
      <div className="mb-10 md:mb-14 lg:mb-16 border-b border-border pb-7 md:pb-9">
        <div className="flex items-start justify-between gap-4">
          <div data-felix-target="greeting">
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-normal text-foreground leading-none">
               {firstWelcome ? "Welcome to the Trade Program" : "Welcome back"}{profile?.first_name ? `, ${profile.first_name}` : ""}
            </h1>
            {profile?.company && showTradePrice && (
              <p className="trade-micro-label mt-4 font-body uppercase text-muted-foreground">
                {profile.company} • {tierLabel} partner
              </p>
            )}
            <button
              type="button"
              onClick={startFelixTour}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Sparkles className="h-3 w-3" />
              Meet {guideName}
            </button>
          </div>
          {spendCents !== null && tier !== "platinum" && tierConfig.gold.min_spend_cents > 0 && (() => {
            const nextCfg = tier === "silver" ? tierConfig.gold : tierConfig.platinum;
            const prevThreshold = tier === "silver" ? tierConfig.silver.min_spend_cents : tierConfig.gold.min_spend_cents;
            const progressPct = Math.min(100, Math.max(0,
              ((spendCents - prevThreshold) / (nextCfg.min_spend_cents - prevThreshold)) * 100
            ));
            const fmt = (cents: number) => tierVolume.format(tierVolume.amount(cents));
            const nextMilestone = tier === "silver" ? tierVolume.gold : tierVolume.platinum;
            return (
              <div data-felix-target="tier-volume-tracker" className="hidden lg:block w-[340px] shrink-0 self-center rounded-md border border-border px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="trade-micro-label uppercase text-muted-foreground">Tier Volume Tracker</p>
                  <p className="font-body text-[11px] text-muted-foreground tabular-nums">
                    {fmt(spendCents)} <span className="opacity-60">/ {tierVolume.format(nextMilestone)}</span>
                  </p>
                </div>
                <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="mt-2 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Rolling 12-month confirmed spend · next: {nextCfg.label} {Math.round(nextCfg.discount_pct * 100)}%
                </p>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 content-start items-start gap-x-5 gap-y-14 md:gap-y-20">
        {DASH_CARDS.map((card, index) => (
          <Link
            key={card.to}
            to={card.to}
            data-felix-target={card.key === "dash-showroom" ? "dashboard-showroom" : undefined}
            data-tour-target={card.key === "dash-designers" ? "designers" : card.key === "dash-library" ? "resources" : undefined}
            className={`group ${card.key === "dash-showroom" ? "group/radar" : ""} flex h-full flex-col pb-2 md:pb-4 tour-target ${index === 0 ? "lg:col-span-7" : index === 1 ? "lg:col-span-5" : "lg:col-span-4"}`}
          >
            <div className={`relative overflow-hidden bg-muted ${index === 0 ? "aspect-[16/9]" : index === 1 ? "aspect-[10/9]" : "aspect-[4/3]"}`}>
              {getCardImage(card) ? (
                <img
                  src={getCardImage(card)}
                  alt={card.title}
                  loading="lazy"
                  className={`w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025] ${getCardPosition(card)}`}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <card.icon className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
              {card.key === "dash-ai-walkthrough" && <WalkthroughCardPreview />}
              {card.key === "dash-showroom" && (
                <button
                  type="button"
                  data-felix-hotspot
                  aria-label="Enter the Interactive Galleries"
                  className="absolute inset-0 z-10 hidden items-center justify-center cursor-pointer"
                >
                  <span className="relative flex items-center justify-center transition-transform duration-500 ease-out group-hover/radar:scale-110">
                    <span className="absolute h-12 w-12 rounded-full bg-stone-400/15 animate-radar-ping motion-reduce:animate-none" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-stone-900 border border-white shadow-sm" />
                  </span>
                </button>
              )}
              {card.key === "dash-3d-studio" && studioStats.count > 0 && (
                <span className="absolute top-3 right-3 inline-flex items-center px-2 py-1 bg-background/90 font-body text-[10px] uppercase tracking-[0.15em] text-foreground">
                  {studioStats.count} render{studioStats.count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="mt-3 min-h-[92px] border-t border-border pt-4 md:min-h-[104px]">
              <p className="trade-micro-label text-muted-foreground mb-1">0{index + 1} — Collection</p>
              <h3 className="font-display text-lg md:text-xl text-foreground mb-1">{card.title}</h3>
              <p className="trade-card-description font-body text-[11px] md:text-xs leading-relaxed">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {activeProjects.length > 0 && (
        <section className="mt-14 border-t border-border pt-6 md:mt-20" aria-label="Active workspace projects">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl text-foreground">Projects & Interventions</h2>
            <Link to="/trade/projects" className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">View all projects →</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {activeProjects.slice(0, 4).map((project, index) => (
              <div
                key={project.id}
                className="group flex min-h-36 flex-col justify-between border border-border bg-background p-5 transition-colors hover:border-foreground/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <FolderOpen className="h-5 w-5 text-muted-foreground/70" aria-hidden="true" />
                  {isSampleProject(project) && <span className="border border-accent px-2 py-0.5 font-body text-[10px] uppercase text-accent">Sample project</span>}
                </div>
                <div className="mt-6">
                  <p className="trade-micro-label text-muted-foreground">{String(index + 1).padStart(2, "0")} — Active project</p>
                  <Link to={projectDefaultUrl(project.id, projectBoards)} className="block hover:underline">
                    <h3 className="mt-1 font-display text-lg text-foreground">{project.name}</h3>
                  </Link>
                  {project.location && <p className="mt-1 font-body text-xs text-muted-foreground">{project.location}</p>}
                  {(syncedItemsByProject[project.id] || []).map((item) => (
                    <p key={item.boardItemId} className="mt-2 font-body text-xs text-muted-foreground">
                      {item.productName} · {item.designer}
                    </p>
                  ))}
                  {isSampleProject(project) && canEdit && <Button asChild variant="link" className="mt-3 h-auto p-0 text-xs"><Link to={`/trade/projects?convert=${encodeURIComponent(project.id)}`}>Create my first real project →</Link></Button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Most Popular */}
      <MostPopularProducts />

      {/* Project-Aware Recommendations */}
      <BoardRecommendations />

      {/* Recent Activity */}
      <div className="mt-16 md:mt-24">
        <h2 className="font-display text-2xl text-foreground mb-6 flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </h2>
        {loading ? (
          <div className="divide-y divide-border border-y border-border">
            {Array.from({ length: 4 }).map((_, i) => <ActivityRowSkeleton key={i} />)}
          </div>
        ) : activity.length === 0 ? (
          <div className="border-y border-border py-12 text-center">
            <p className="font-body text-sm text-muted-foreground">
              No recent activity yet. Start by browsing the gallery or uploading documents.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {activity.map((item) => {
              const inner = (
                <>
                  {item.type === "document" ? (
                    <FileDown className="h-4 w-4 text-[hsl(var(--pdf-red))] shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-foreground truncate">{item.title}</p>
                    <p className="trade-card-description font-body text-[10px]">{item.subtitle}</p>
                  </div>
                  <span className="font-body text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeDate(item.date)}
                  </span>
                </>
              );
              return item.link ? (
                <Link
                  key={item.id}
                  to={item.link}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Brand Folders */}
      <div className="mt-16 md:mt-24">
        <h2 className="font-display text-2xl text-foreground mb-6">Brands</h2>
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
            {Array.from({ length: 10 }).map((_, i) => <BrandFolderSkeleton key={i} />)}
          </div>
        ) : brands.length === 0 ? (
          <div className="border-y border-border py-12 text-center">
            <p className="font-body text-sm text-muted-foreground">
              No brands available yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 border-t border-l border-border">
            {brands.map((brand) => {
              const isEmpty = brand.doc_count === 0;
              return (
                <Link
                  key={brand.brand_name}
                  to={`/trade/documents?brand=${encodeURIComponent(brand.brand_name)}`}
                  className={`group flex min-h-36 flex-col items-center justify-center gap-3 border-r border-b border-border p-5 transition-colors hover:bg-muted/40 ${
                    isEmpty
                      ? "opacity-60 hover:opacity-80"
                      : ""
                  }`}
                >
                  {isEmpty ? (
                    <FolderClosed className="h-8 w-8 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                  ) : (
                    <FolderOpen className="h-8 w-8 text-accent group-hover:text-foreground transition-colors" />
                  )}
                  <span className="font-body text-xs text-foreground text-center leading-tight truncate w-full">
                    {brand.brand_name}
                  </span>
                  <span className={`font-body text-[10px] ${isEmpty ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                    {isEmpty ? "Empty" : `${brand.doc_count} ${brand.doc_count === 1 ? "file" : "files"}`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default TradeDashboard;
