import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart3, Users, FileText, Package, Box, Heart, TrendingUp, AlertTriangle, CheckCircle2, Lightbulb,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompetitiveAnalysis from "@/components/trade/CompetitiveAnalysis";

interface PlatformStats {
  totalProducts: number;
  tradeUsers: number;
  totalQuotes: number;
  draftQuotes: number;
  submittedQuotes: number;
  confirmedQuotes: number;
  sampleRequests: number;
  axoRequests: number;
  presentations: number;
  galleryItems: number;
  totalFavorites: number;
  topFavoritedProducts: { product_name: string; brand_name: string; count: number }[];
}

const StatCard = ({ icon: Icon, label, value, subtitle, color }: { icon: any; label: string; value: number | string; subtitle?: string; color?: string }) => (
  <Card className="p-4 space-y-2">
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color || "bg-primary/10"}`}>
        <Icon className={`w-4 h-4 ${color ? "text-primary-foreground" : "text-primary"}`} />
      </div>
      <span className="font-body text-xs text-muted-foreground">{label}</span>
    </div>
    <p className="font-display text-2xl text-foreground">{value}</p>
    {subtitle && <p className="font-body text-[10px] text-muted-foreground">{subtitle}</p>}
  </Card>
);

const InsightCard = ({ icon: Icon, title, description, type }: { icon: any; title: string; description: string; type: "success" | "warning" | "idea" }) => {
  const styles = {
    success: "border-emerald-500/20 bg-emerald-500/5",
    warning: "border-amber-500/20 bg-amber-500/5",
    idea: "border-primary/20 bg-primary/5",
  };
  const iconStyles = {
    success: "text-emerald-500",
    warning: "text-amber-500",
    idea: "text-primary",
  };
  return (
    <Card className={`p-4 ${styles[type]}`}>
      <div className="flex gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconStyles[type]}`} />
        <div>
          <p className="font-display text-xs text-foreground">{title}</p>
          <p className="font-body text-[11px] text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </Card>
  );
};

export default function TradeInsights() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchStats = async () => {
      try {
        const [
          { count: totalProducts },
          { count: tradeUsers },
          { data: quotes },
          { count: sampleRequests },
          { count: axoRequests },
          { count: presentations },
          { count: galleryItems },
          { count: totalFavorites },
        ] = await Promise.all([
          supabase.from("trade_products").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "trade_user"),
          supabase.from("trade_quotes").select("status"),
          supabase.from("trade_sample_requests").select("*", { count: "exact", head: true }),
          supabase.from("axonometric_requests").select("*", { count: "exact", head: true }),
          supabase.from("presentations").select("*", { count: "exact", head: true }),
          supabase.from("axonometric_gallery").select("*", { count: "exact", head: true }),
          supabase.from("trade_favorites").select("*", { count: "exact", head: true }),
        ]);

        const quoteStatuses = (quotes || []) as { status: string }[];
        const draftQuotes = quoteStatuses.filter(q => q.status === "draft").length;
        const submittedQuotes = quoteStatuses.filter(q => q.status === "submitted").length;
        const confirmedQuotes = quoteStatuses.filter(q => q.status === "confirmed").length;

        // Top favorited products - query with join
        const { data: favData } = await supabase
          .from("trade_favorites")
          .select("product_id, trade_products(product_name, brand_name)");

        const productCounts: Record<string, { product_name: string; brand_name: string; count: number }> = {};
        (favData || []).forEach((f: any) => {
          const pid = f.product_id;
          if (!productCounts[pid]) {
            productCounts[pid] = {
              product_name: f.trade_products?.product_name || "Unknown",
              brand_name: f.trade_products?.brand_name || "Unknown",
              count: 0,
            };
          }
          productCounts[pid].count++;
        });
        const topFavoritedProducts = Object.values(productCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setStats({
          totalProducts: totalProducts || 0,
          tradeUsers: tradeUsers || 0,
          totalQuotes: quoteStatuses.length,
          draftQuotes,
          submittedQuotes,
          confirmedQuotes,
          sampleRequests: sampleRequests || 0,
          axoRequests: axoRequests || 0,
          presentations: presentations || 0,
          galleryItems: galleryItems || 0,
          totalFavorites: totalFavorites || 0,
          topFavoritedProducts,
        });
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="p-8 text-center font-body text-muted-foreground">Admin access required</div>;
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-6 w-40 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const quoteConversionRate = stats.totalQuotes > 0
    ? Math.round((stats.confirmedQuotes / stats.totalQuotes) * 100)
    : 0;

  const featureAdoption = [
    { name: "Quote Builder", value: stats.totalQuotes, max: Math.max(stats.totalQuotes, 20) },
    { name: "Sample Requests", value: stats.sampleRequests, max: Math.max(stats.sampleRequests, 20) },
    { name: "3D Studio", value: stats.axoRequests, max: Math.max(stats.axoRequests, 20) },
    { name: "Presentations", value: stats.presentations, max: Math.max(stats.presentations, 20) },
    { name: "Favorites", value: stats.totalFavorites, max: Math.max(stats.totalFavorites, 20) },
  ];

  // Generate insights
  const insights: { icon: any; title: string; description: string; type: "success" | "warning" | "idea" }[] = [];

  if (stats.sampleRequests === 0) {
    insights.push({
      icon: AlertTriangle,
      title: "Sample Requests Unused",
      description: "No trade professionals have requested samples yet. Consider featuring this capability more prominently on the dashboard and sending an onboarding email highlighting the sample program.",
      type: "warning",
    });
  }

  if (stats.draftQuotes > stats.submittedQuotes + stats.confirmedQuotes) {
    insights.push({
      icon: AlertTriangle,
      title: "High Draft-to-Submit Drop-off",
      description: `${stats.draftQuotes} of ${stats.totalQuotes} quotes are still in draft. Trade users may find the submission process unclear or need product pricing to be filled in first.`,
      type: "warning",
    });
  }

  if (stats.axoRequests < stats.tradeUsers) {
    insights.push({
      icon: Lightbulb,
      title: "3D Studio Awareness Gap",
      description: "Most trade users haven't tried the 3D Studio. Consider adding a contextual prompt in the Showroom linking to axonometric generation from product pages.",
      type: "idea",
    });
  }

  insights.push({
    icon: Lightbulb,
    title: "New: Product Favorites",
    description: "Favorites are now live — trade professionals can save products and build shortlists before committing to a quote. Monitor adoption here.",
    type: "idea",
  });

  if (stats.totalProducts >= 80) {
    insights.push({
      icon: CheckCircle2,
      title: "Strong Product Catalogue",
      description: `${stats.totalProducts} active products across your portfolio. A well-stocked catalogue drives professional engagement and repeat visits.`,
      type: "success",
    });
  }

  if (stats.confirmedQuotes > 0) {
    insights.push({
      icon: CheckCircle2,
      title: "Quotes Converting",
      description: `${quoteConversionRate}% quote conversion rate (${stats.confirmedQuotes} confirmed of ${stats.totalQuotes}). The quote-to-order pipeline is working.`,
      type: "success",
    });
  }

  return (
    <>
      <Helmet>
        <title>Platform Insights — Maison Affluency Trade</title>
      </Helmet>
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
      {/* Header */}
        <div>
          <h1 className="font-display text-lg text-foreground">Platform Insights</h1>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Overview of trade portal health, feature adoption, and actionable recommendations.
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="font-body">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="competitive" className="text-xs">Competitive Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="competitive">
            <CompetitiveAnalysis />
          </TabsContent>

          <TabsContent value="overview" className="space-y-8">

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Trade Professionals" value={stats.tradeUsers} subtitle="Approved accounts" />
          <StatCard icon={Package} label="Active Products" value={stats.totalProducts} />
          <StatCard icon={FileText} label="Total Quotes" value={stats.totalQuotes} subtitle={`${stats.draftQuotes} draft · ${stats.submittedQuotes} submitted · ${stats.confirmedQuotes} confirmed`} />
          <StatCard icon={Heart} label="Product Favorites" value={stats.totalFavorites} subtitle="Saved by professionals" />
          <StatCard icon={Package} label="Sample Requests" value={stats.sampleRequests} />
          <StatCard icon={Box} label="3D Studio Requests" value={stats.axoRequests} />
          <StatCard icon={BarChart3} label="Presentations" value={stats.presentations} />
          <StatCard icon={TrendingUp} label="Quote Conversion" value={`${quoteConversionRate}%`} subtitle="Draft → Confirmed" />
        </div>

        {/* Feature Adoption */}
        <Card className="p-5 space-y-4">
          <h2 className="font-display text-sm text-foreground">Feature Adoption</h2>
          <div className="space-y-3">
            {featureAdoption.map((f) => (
              <div key={f.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-body text-xs text-foreground">{f.name}</span>
                  <span className="font-body text-[10px] text-muted-foreground">{f.value} uses</span>
                </div>
                <Progress value={(f.value / f.max) * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>

        {/* Insights & Recommendations */}
        <div className="space-y-3">
          <h2 className="font-display text-sm text-foreground">Insights & Recommendations</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((insight, i) => (
              <InsightCard key={i} {...insight} />
            ))}
          </div>
        </div>

        {/* Top Favorited Products */}
        {stats.topFavoritedProducts.length > 0 && (
          <Card className="p-5 space-y-3">
            <h2 className="font-display text-sm text-foreground">Most Favorited Products</h2>
            <div className="space-y-2">
              {stats.topFavoritedProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <span className="font-body text-xs text-foreground">{p.product_name}</span>
                    <span className="font-body text-[10px] text-muted-foreground ml-2">{p.brand_name}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{p.count} saves</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
