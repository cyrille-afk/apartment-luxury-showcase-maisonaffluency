import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe, Users, TrendingUp, RefreshCw, MapPin, ExternalLink, AlertTriangle,
  CheckCircle2, BarChart3, Plus, Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchCompetitorGalleries,
  fetchCompetitorDesigners,
  fetchAuctionBenchmarks,
  fetchCompetitorTraffic,
  upsertTrafficEntry,
  triggerCompetitorScrape,
  triggerSimilarWebScrape,
} from "@/lib/api/competitors";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis,
} from "recharts";

interface Gallery {
  id: string;
  name: string;
  website_url: string;
  location: string;
  region: string;
  description: string | null;
  last_scraped_at: string | null;
  scrape_status: string;
}

interface Designer {
  id: string;
  gallery_id: string;
  designer_name: string;
  is_overlap: boolean;
  profile_url: string | null;
  competitor_galleries: { name: string } | null;
}

interface AuctionLot {
  id: string;
  auction_house: string;
  designer_name: string;
  piece_title: string;
  sold_price_usd: number | null;
  estimate_low_usd: number | null;
  estimate_high_usd: number | null;
  sale_date: string | null;
  lot_url: string | null;
}

interface TrafficRow {
  id: string;
  gallery_id: string;
  month: string;
  monthly_visits: number | null;
  bounce_rate: number | null;
  avg_duration_seconds: number | null;
  source: string;
  competitor_galleries: { name: string } | null;
}

const formatUsd = (cents: number | null) =>
  cents ? `$${cents.toLocaleString()}` : "—";

const regionLabels: Record<string, string> = {
  asia: "Asia-Pacific",
  middle_east: "Middle East",
  international: "International",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(24, 80%, 55%)",
  "hsl(160, 60%, 40%)",
  "hsl(280, 50%, 55%)",
  "hsl(45, 85%, 50%)",
];

// ── Traffic Entry Form ──────────────────────────────────────────────
function TrafficForm({
  galleries,
  onSaved,
}: {
  galleries: Gallery[];
  onSaved: () => void;
}) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [galleryId, setGalleryId] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [visits, setVisits] = useState("");
  const [bounce, setBounce] = useState("");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!galleryId || !month) {
      toast.error("Select a gallery and month");
      return;
    }
    setSaving(true);
    try {
      await upsertTrafficEntry({
        gallery_id: galleryId,
        month: `${month}-01`,
        monthly_visits: visits ? parseInt(visits) : null,
        bounce_rate: bounce ? parseFloat(bounce) : null,
        avg_duration_seconds: duration ? parseInt(duration) : null,
      });
      toast.success("Traffic data saved");
      setVisits("");
      setBounce("");
      setDuration("");
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save traffic data");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
      <div className="col-span-2 md:col-span-1">
        <label className="font-body text-[10px] text-muted-foreground mb-1 block">
          Gallery
        </label>
        <Select value={galleryId} onValueChange={setGalleryId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {galleries.map((g) => (
              <SelectItem key={g.id} value={g.id} className="text-xs">
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="font-body text-[10px] text-muted-foreground mb-1 block">
          Month
        </label>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div>
        <label className="font-body text-[10px] text-muted-foreground mb-1 block">
          Monthly Visits
        </label>
        <Input
          type="number"
          placeholder="e.g. 12500"
          value={visits}
          onChange={(e) => setVisits(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div>
        <label className="font-body text-[10px] text-muted-foreground mb-1 block">
          Bounce Rate %
        </label>
        <Input
          type="number"
          step="0.1"
          placeholder="e.g. 42.5"
          value={bounce}
          onChange={(e) => setBounce(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div>
        <label className="font-body text-[10px] text-muted-foreground mb-1 block">
          Avg Duration (s)
        </label>
        <Input
          type="number"
          placeholder="e.g. 180"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving}
        className="h-8 gap-1.5 text-xs"
      >
        <Save className="w-3 h-3" />
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

// ── Traffic Trend Charts ────────────────────────────────────────────
function TrafficCharts({
  traffic,
  galleries,
}: {
  traffic: TrafficRow[];
  galleries: Gallery[];
}) {
  const galleryNames = useMemo(() => {
    const map: Record<string, string> = {};
    galleries.forEach((g) => (map[g.id] = g.name));
    return map;
  }, [galleries]);

  // Pivot data: each month becomes a row with gallery columns
  const chartData = useMemo(() => {
    const byMonth: Record<string, Record<string, any>> = {};
    traffic.forEach((t) => {
      const m = t.month.substring(0, 7); // YYYY-MM
      if (!byMonth[m]) byMonth[m] = { month: m };
      const name = galleryNames[t.gallery_id] || "Unknown";
      byMonth[m][`${name}_visits`] = t.monthly_visits;
      byMonth[m][`${name}_bounce`] = t.bounce_rate ? Number(t.bounce_rate) : null;
      byMonth[m][`${name}_duration`] = t.avg_duration_seconds;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }, [traffic, galleryNames]);

  const activeGalleryIds = useMemo(
    () => [...new Set(traffic.map((t) => t.gallery_id))],
    [traffic]
  );

  if (chartData.length < 2) {
    return (
      <p className="font-body text-[11px] text-muted-foreground text-center py-6">
        Add at least 2 months of data to see trend charts
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Monthly Visits */}
      <div className="space-y-2">
        <h4 className="font-display text-xs text-foreground">Monthly Visits</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {activeGalleryIds.map((gid, i) => (
              <Line
                key={gid}
                type="monotone"
                dataKey={`${galleryNames[gid]}_visits`}
                name={galleryNames[gid]}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bounce Rate */}
      <div className="space-y-2">
        <h4 className="font-display text-xs text-foreground">Bounce Rate %</h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {activeGalleryIds.map((gid, i) => (
              <Line
                key={gid}
                type="monotone"
                dataKey={`${galleryNames[gid]}_bounce`}
                name={galleryNames[gid]}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Latest Traffic Table ────────────────────────────────────────────
function TrafficTable({
  traffic,
  galleries,
}: {
  traffic: TrafficRow[];
  galleries: Gallery[];
}) {
  // Get latest month per gallery
  const latest = useMemo(() => {
    const map: Record<string, TrafficRow> = {};
    traffic.forEach((t) => {
      if (!map[t.gallery_id] || t.month > map[t.gallery_id].month) {
        map[t.gallery_id] = t;
      }
    });
    return Object.values(map).sort(
      (a, b) => (b.monthly_visits || 0) - (a.monthly_visits || 0)
    );
  }, [traffic]);

  const galleryNames = useMemo(() => {
    const map: Record<string, string> = {};
    galleries.forEach((g) => (map[g.id] = g.name));
    return map;
  }, [galleries]);

  if (latest.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="font-body text-[10px] text-muted-foreground pb-2 pr-4">Gallery</th>
            <th className="font-body text-[10px] text-muted-foreground pb-2 pr-4 text-right">Month</th>
            <th className="font-body text-[10px] text-muted-foreground pb-2 pr-4 text-right">Visits</th>
            <th className="font-body text-[10px] text-muted-foreground pb-2 pr-4 text-right">Bounce</th>
            <th className="font-body text-[10px] text-muted-foreground pb-2 text-right">Avg Duration</th>
          </tr>
        </thead>
        <tbody>
          {latest.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-0">
              <td className="font-body text-xs text-foreground py-2 pr-4">
                {galleryNames[t.gallery_id] || "Unknown"}
              </td>
              <td className="font-body text-xs text-muted-foreground py-2 pr-4 text-right">
                {t.month.substring(0, 7)}
              </td>
              <td className="font-display text-xs text-foreground py-2 pr-4 text-right">
                {t.monthly_visits?.toLocaleString() ?? "—"}
              </td>
              <td className="font-display text-xs text-foreground py-2 pr-4 text-right">
                {t.bounce_rate ? `${Number(t.bounce_rate).toFixed(1)}%` : "—"}
              </td>
              <td className="font-display text-xs text-foreground py-2 text-right">
                {t.avg_duration_seconds
                  ? `${Math.floor(t.avg_duration_seconds / 60)}m ${t.avg_duration_seconds % 60}s`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────
export default function CompetitiveAnalysis() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [auctions, setAuctions] = useState<AuctionLot[]>([]);
  const [traffic, setTraffic] = useState<TrafficRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapingSW, setScrapingSW] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadData = async () => {
    try {
      const [g, d, a, t] = await Promise.all([
        fetchCompetitorGalleries(),
        fetchCompetitorDesigners(),
        fetchAuctionBenchmarks(),
        fetchCompetitorTraffic(),
      ]);
      setGalleries(g as Gallery[]);
      setDesigners(d as Designer[]);
      setAuctions(a as AuctionLot[]);
      setTraffic(t as unknown as TrafficRow[]);
    } catch (err) {
      console.error("Failed to load competitive data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScrape = async () => {
    setScraping(true);
    try {
      const result = await triggerCompetitorScrape();
      toast.success(
        `Scrape complete: ${result?.galleries?.length || 0} galleries processed, ${result?.auction_lots_found || 0} auction lots found`
      );
      await loadData();
    } catch (err) {
      console.error("Scrape failed:", err);
      toast.error("Scraping failed — check Firecrawl connection");
    } finally {
      setScraping(false);
    }
  };

  const handleSimilarWebScrape = async () => {
    setScrapingSW(true);
    try {
      const result = await triggerSimilarWebScrape();
      const successes = result?.results?.filter((r: any) => r.status === "success") || [];
      toast.success(
        `SimilarWeb scrape done: ${successes.length} galleries with traffic data`
      );
      await loadData();
    } catch (err) {
      console.error("SimilarWeb scrape failed:", err);
      toast.error("SimilarWeb scrape failed — check Firecrawl connection");
    } finally {
      setScrapingSW(false);
    }
  };

  const overlapDesigners = designers.filter((d) => d.is_overlap);
  const totalDesigners = designers.length;
  const overlapRate =
    totalDesigners > 0
      ? Math.round((overlapDesigners.length / totalDesigners) * 100)
      : 0;

  const designersByGallery = galleries.map((g) => ({
    gallery: g,
    designers: designers.filter((d) => d.gallery_id === g.id),
  }));

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm text-foreground">
            Competitive Intelligence
          </h2>
          <p className="font-body text-[11px] text-muted-foreground mt-1">
            Automated tracking of competitor galleries and auction benchmarks
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleScrape}
          disabled={scraping}
          className="gap-2 font-body text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scraping ? "animate-spin" : ""}`} />
          {scraping ? "Scraping…" : "Run Scrape"}
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            <span className="font-body text-xs text-muted-foreground">Galleries Tracked</span>
          </div>
          <p className="font-display text-2xl text-foreground">{galleries.length}</p>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="font-body text-xs text-muted-foreground">Designers Identified</span>
          </div>
          <p className="font-display text-2xl text-foreground">{totalDesigners}</p>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <span className="font-body text-xs text-muted-foreground">Roster Overlap</span>
          </div>
          <p className="font-display text-2xl text-foreground">{overlapRate}%</p>
          <p className="font-body text-[10px] text-muted-foreground">
            {overlapDesigners.length} shared designers
          </p>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <span className="font-body text-xs text-muted-foreground">Auction Records</span>
          </div>
          <p className="font-display text-2xl text-foreground">{auctions.length}</p>
        </Card>
      </div>

      {/* ── Traffic Benchmarks ─────────────────────────────────────── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-display text-sm text-foreground">
              Traffic Benchmarks
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSimilarWebScrape}
              disabled={scrapingSW}
              className="gap-1.5 text-xs font-body"
            >
              <RefreshCw className={`w-3 h-3 ${scrapingSW ? "animate-spin" : ""}`} />
              {scrapingSW ? "Scraping…" : "Auto-Scrape SimilarWeb"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(!showForm)}
              className="gap-1.5 text-xs font-body"
            >
              <Plus className="w-3 h-3" />
              {showForm ? "Hide Form" : "Add Data"}
            </Button>
          </div>
        </div>
        <p className="font-body text-[11px] text-muted-foreground">
          Monthly traffic estimates from SimilarWeb or manual entry — compare
          visits, bounce rate, and session duration across galleries.
        </p>

        {showForm && (
          <TrafficForm galleries={galleries} onSaved={loadData} />
        )}

        <TrafficTable traffic={traffic} galleries={galleries} />
        <TrafficCharts traffic={traffic} galleries={galleries} />

        {traffic.length === 0 && !showForm && (
          <div className="text-center py-6 space-y-2">
            <BarChart3 className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="font-body text-xs text-muted-foreground">
              No traffic data yet — click "Add Data" to enter SimilarWeb estimates
            </p>
          </div>
        )}
      </Card>

      {/* Competitor Gallery Cards */}
      <div className="space-y-3">
        <h3 className="font-display text-xs text-foreground uppercase tracking-wider">
          Competitor Galleries
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {designersByGallery.map(({ gallery, designers: gDesigners }) => {
            const overlap = gDesigners.filter((d) => d.is_overlap).length;
            return (
              <Card key={gallery.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-display text-sm text-foreground">{gallery.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="font-body text-[10px] text-muted-foreground">{gallery.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-body">
                      {regionLabels[gallery.region] || gallery.region}
                    </Badge>
                    <a href={gallery.website_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {gallery.description && (
                  <p className="font-body text-[11px] text-muted-foreground">{gallery.description}</p>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-[10px] text-foreground">{gDesigners.length} designers identified</span>
                    {overlap > 0 && (
                      <span className="font-body text-[10px] text-amber-500">{overlap} overlap</span>
                    )}
                  </div>
                  <Progress value={gDesigners.length > 0 ? (overlap / gDesigners.length) * 100 : 0} className="h-1.5" />
                </div>

                {gDesigners.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {gDesigners.slice(0, 8).map((d) => (
                      <Badge key={d.id} variant={d.is_overlap ? "default" : "outline"} className="text-[9px] font-body">
                        {d.designer_name}
                      </Badge>
                    ))}
                    {gDesigners.length > 8 && (
                      <Badge variant="outline" className="text-[9px] font-body">+{gDesigners.length - 8} more</Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="font-body text-[10px] text-muted-foreground">
                    {gallery.last_scraped_at
                      ? `Last scraped ${new Date(gallery.last_scraped_at).toLocaleDateString()}`
                      : "Not yet scraped"}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-[9px] font-body ${
                      gallery.scrape_status === "completed"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : gallery.scrape_status === "error"
                        ? "bg-destructive/10 text-destructive"
                        : ""
                    }`}
                  >
                    {gallery.scrape_status}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Designer Overlap */}
      {overlapDesigners.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
            <h3 className="font-display text-sm text-foreground">Shared Roster — Designer Overlap</h3>
          </div>
          <p className="font-body text-[11px] text-muted-foreground">
            These designers are represented by both Maison Affluency and at least one competitor gallery.
          </p>
          <div className="space-y-2">
            {overlapDesigners.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <span className="font-body text-xs text-foreground">{d.designer_name}</span>
                <Badge variant="secondary" className="text-[10px] font-body">
                  {(d.competitor_galleries as any)?.name || "Unknown"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Auction Benchmarks */}
      {auctions.length > 0 && (
        <Card className="p-5 space-y-3">
          <h3 className="font-display text-sm text-foreground">Auction Price Benchmarks</h3>
          <p className="font-body text-[11px] text-muted-foreground">
            Recent auction results from Phillips, Christie's, Piasa & Sotheby's
          </p>
          <div className="space-y-2">
            {auctions.slice(0, 15).map((lot) => (
              <div key={lot.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-foreground truncate">{lot.piece_title.substring(0, 80)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-body text-[10px] text-muted-foreground">{lot.designer_name}</span>
                    <span className="font-body text-[10px] text-muted-foreground">·</span>
                    <span className="font-body text-[10px] text-muted-foreground">{lot.auction_house}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-sm text-foreground">{formatUsd(lot.sold_price_usd)}</p>
                  {lot.estimate_low_usd && lot.estimate_high_usd && (
                    <p className="font-body text-[10px] text-muted-foreground">
                      Est. {formatUsd(lot.estimate_low_usd)} – {formatUsd(lot.estimate_high_usd)}
                    </p>
                  )}
                </div>
                {lot.lot_url && (
                  <a href={lot.lot_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {auctions.length === 0 && !loading && (
        <Card className="p-5 border-dashed">
          <div className="text-center space-y-2">
            <TrendingUp className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="font-body text-xs text-muted-foreground">
              No auction data yet — click "Run Scrape" to collect pricing benchmarks
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
