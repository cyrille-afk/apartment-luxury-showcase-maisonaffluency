import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import {
  Image, FileText, FolderOpen, FolderClosed,
  Clock, FileSpreadsheet, BookOpen, FileDown, MapPin, Package, Box, Users, Sparkles,
} from "lucide-react";
import { ActivityRowSkeleton, BrandFolderSkeleton } from "@/components/trade/skeletons";
import { MostPopularProducts } from "@/components/trade/MostPopularProducts";
import { BoardRecommendations } from "@/components/trade/BoardRecommendations";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { loadName, DEFAULT_NAME } from "@/components/trade/conciergeGreeting";

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
  { key: "dash-showroom", title: "Browse Showroom", description: "Review items from the Maison Affluency gallery", icon: MapPin, to: "/trade/showroom", fallbackId: "living-room-hero_zxfcxl", fallbackImage: null as string | null, defaultGravity: "auto" },
  { key: "dash-gallery", title: "Browse Website Products", description: "View our full collection with trade pricing", icon: Image, to: "/trade/gallery", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/v1773811405/IMG_6996_tfx4bp.jpg", defaultGravity: "south" },
  { key: "dash-library", title: "Resources", description: "Access catalogues, inventory & spec sheets", icon: FolderOpen, to: "/trade/documents", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_400,c_fill,g_auto,q_auto,f_auto/v1774172614/2.-Digital-Resources_qbsqxs.jpg", defaultGravity: "auto" },
  { key: "dash-designers", title: "Designers & Ateliers Library", description: "Discover 32 ateliers and 274 designers", icon: Users, to: "/trade/designers", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/w_600,h_400,c_fill,g_auto,q_auto,f_auto/v1773838925/1_6Jp3vJWe7VFlFHZ9WhSJng_u6ai93.jpg", defaultGravity: "auto" },
  { key: "dash-quotes", title: "Quote Builder", description: "Create branded quotes for your clients", icon: FileText, to: "/trade/quotes", fallbackId: null as string | null, fallbackImage: "https://res.cloudinary.com/dif1oamtj/image/upload/e_contrast:20,e_saturation:15/v1773799140/Screen_Shot_2026-03-18_at_9.57.16_AM_mpvvpg.png", defaultGravity: "auto" },
  { key: "dash-3d-studio", title: "3D Studio", description: "Submit drawings for 3D renders & browse gallery", icon: Box, to: "/trade/axonometric-requests", fallbackId: null as string | null, fallbackImage: null as string | null, defaultGravity: "auto" },
];

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

const TradeDashboard = () => {
  const { profile } = useAuth();
  const [brands, setBrands] = useState<BrandFolder[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroOverrides, setHeroOverrides] = useState<Record<string, { image_url: string; gravity: string }>>({});
  const [studioStats, setStudioStats] = useState<{ count: number; latestImage: string | null }>({ count: 0, latestImage: null });

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
    // 3D Studio: use latest gallery render as dynamic thumbnail
    if (card.key === "dash-3d-studio" && studioStats.latestImage) return studioStats.latestImage;
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
    <div className="max-w-4xl">
      <div className="mb-6 md:mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl md:text-2xl lg:text-3xl text-foreground">
              Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}
            </h1>
            <p className="font-body text-xs md:text-sm text-muted-foreground mt-1.5">
              {profile?.company && <span>{profile.company} · </span>}
              Your trade dashboard
            </p>
          </div>
          <button
            onClick={() => {
              // Find and click the floating concierge button
              const btn = document.querySelector<HTMLButtonElement>('[aria-label="Open AI Concierge"]');
              if (btn) btn.click();
            }}
            className="shrink-0 flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2 shadow-sm hover:opacity-90 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-body text-[11px] uppercase tracking-[0.15em]">Concierge</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {DASH_CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group border border-border rounded-lg overflow-hidden hover:border-foreground/20 hover:shadow-sm transition-all"
          >
            <div className="relative aspect-[3/2] overflow-hidden">
              {getCardImage(card) ? (
                <img
                  src={getCardImage(card)}
                  alt={card.title}
                  loading="lazy"
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${getCardPosition(card)}`}
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <card.icon className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
              {card.key === "dash-3d-studio" && studioStats.count > 0 && (
                <span className="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm font-body text-[10px] text-foreground border border-border">
                  {studioStats.count} render{studioStats.count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className={`p-3 md:p-4 ${card.key === "dash-3d-studio" ? "bg-foreground" : ""}`}>
              <h3 className={`font-display text-sm md:text-base mb-0.5 md:mb-1 ${card.key === "dash-3d-studio" ? "text-background" : "text-foreground"}`}>{card.title}</h3>
              <p className={`font-body text-[10px] md:text-xs leading-tight ${card.key === "dash-3d-studio" ? "text-background/70" : "text-muted-foreground"}`}>{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Most Popular */}
      <MostPopularProducts />

      {/* Project-Aware Recommendations */}
      <BoardRecommendations />

      {/* Recent Activity */}
      <div className="mt-10">
        <h2 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </h2>
        {loading ? (
          <div className="border border-border rounded-lg divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => <ActivityRowSkeleton key={i} />)}
          </div>
        ) : activity.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="font-body text-sm text-muted-foreground">
              No recent activity yet. Start by browsing the gallery or uploading documents.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
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
                    <p className="font-body text-[10px] text-muted-foreground">{item.subtitle}</p>
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
      <div className="mt-10">
        <h2 className="font-display text-lg text-foreground mb-4">Brands</h2>
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
            {Array.from({ length: 10 }).map((_, i) => <BrandFolderSkeleton key={i} />)}
          </div>
        ) : brands.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <p className="font-body text-sm text-muted-foreground">
              No brands available yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
            {brands.map((brand) => {
              const isEmpty = brand.doc_count === 0;
              return (
                <Link
                  key={brand.brand_name}
                  to={`/trade/documents?brand=${encodeURIComponent(brand.brand_name)}`}
                  className={`group flex flex-col items-center gap-2 border rounded-lg p-4 transition-all ${
                    isEmpty
                      ? "border-border/60 opacity-60 hover:opacity-80"
                      : "border-border hover:border-foreground/20 hover:shadow-sm"
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
