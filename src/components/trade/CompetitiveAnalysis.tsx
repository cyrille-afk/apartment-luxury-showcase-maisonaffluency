import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Globe, Users, TrendingUp, RefreshCw, MapPin, ExternalLink, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchCompetitorGalleries,
  fetchCompetitorDesigners,
  fetchAuctionBenchmarks,
  triggerCompetitorScrape,
} from "@/lib/api/competitors";

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
  lot_url: string | null;
}

const formatUsd = (cents: number | null) =>
  cents ? `$${cents.toLocaleString()}` : "—";

const regionLabels: Record<string, string> = {
  asia: "Asia-Pacific",
  middle_east: "Middle East",
  international: "International",
};

export default function CompetitiveAnalysis() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [auctions, setAuctions] = useState<AuctionLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const loadData = async () => {
    try {
      const [g, d, a] = await Promise.all([
        fetchCompetitorGalleries(),
        fetchCompetitorDesigners(),
        fetchAuctionBenchmarks(),
      ]);
      setGalleries(g as Gallery[]);
      setDesigners(d as Designer[]);
      setAuctions(a as AuctionLot[]);
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

  const overlapDesigners = designers.filter((d) => d.is_overlap);
  const totalDesigners = designers.length;
  const overlapRate =
    totalDesigners > 0
      ? Math.round((overlapDesigners.length / totalDesigners) * 100)
      : 0;

  // Group designers by gallery
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
      {/* Header with Scrape Button */}
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
            <span className="font-body text-xs text-muted-foreground">
              Galleries Tracked
            </span>
          </div>
          <p className="font-display text-2xl text-foreground">
            {galleries.length}
          </p>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <span className="font-body text-xs text-muted-foreground">
              Designers Identified
            </span>
          </div>
          <p className="font-display text-2xl text-foreground">
            {totalDesigners}
          </p>
        </Card>
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <span className="font-body text-xs text-muted-foreground">
              Roster Overlap
            </span>
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
            <span className="font-body text-xs text-muted-foreground">
              Auction Records
            </span>
          </div>
          <p className="font-display text-2xl text-foreground">
            {auctions.length}
          </p>
        </Card>
      </div>

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
                    <h4 className="font-display text-sm text-foreground">
                      {gallery.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="font-body text-[10px] text-muted-foreground">
                        {gallery.location}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-body"
                    >
                      {regionLabels[gallery.region] || gallery.region}
                    </Badge>
                    <a
                      href={gallery.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {gallery.description && (
                  <p className="font-body text-[11px] text-muted-foreground">
                    {gallery.description}
                  </p>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-[10px] text-foreground">
                      {gDesigners.length} designers identified
                    </span>
                    {overlap > 0 && (
                      <span className="font-body text-[10px] text-amber-500">
                        {overlap} overlap
                      </span>
                    )}
                  </div>
                  <Progress
                    value={
                      gDesigners.length > 0
                        ? (overlap / gDesigners.length) * 100
                        : 0
                    }
                    className="h-1.5"
                  />
                </div>

                {gDesigners.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {gDesigners.slice(0, 8).map((d) => (
                      <Badge
                        key={d.id}
                        variant={d.is_overlap ? "default" : "outline"}
                        className="text-[9px] font-body"
                      >
                        {d.designer_name}
                      </Badge>
                    ))}
                    {gDesigners.length > 8 && (
                      <Badge variant="outline" className="text-[9px] font-body">
                        +{gDesigners.length - 8} more
                      </Badge>
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
            <h3 className="font-display text-sm text-foreground">
              Shared Roster — Designer Overlap
            </h3>
          </div>
          <p className="font-body text-[11px] text-muted-foreground">
            These designers are represented by both Maison Affluency and at
            least one competitor gallery.
          </p>
          <div className="space-y-2">
            {overlapDesigners.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
              >
                <span className="font-body text-xs text-foreground">
                  {d.designer_name}
                </span>
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
          <h3 className="font-display text-sm text-foreground">
            Auction Price Benchmarks
          </h3>
          <p className="font-body text-[11px] text-muted-foreground">
            Recent auction results from Phillips, Christie's, Piasa & Sotheby's
          </p>
          <div className="space-y-2">
            {auctions.slice(0, 15).map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-foreground truncate">
                    {lot.piece_title.substring(0, 80)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-body text-[10px] text-muted-foreground">
                      {lot.designer_name}
                    </span>
                    <span className="font-body text-[10px] text-muted-foreground">
                      ·
                    </span>
                    <span className="font-body text-[10px] text-muted-foreground">
                      {lot.auction_house}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-sm text-foreground">
                    {formatUsd(lot.sold_price_usd)}
                  </p>
                  {lot.estimate_low_usd && lot.estimate_high_usd && (
                    <p className="font-body text-[10px] text-muted-foreground">
                      Est. {formatUsd(lot.estimate_low_usd)} –{" "}
                      {formatUsd(lot.estimate_high_usd)}
                    </p>
                  )}
                </div>
                {lot.lot_url && (
                  <a
                    href={lot.lot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state for auctions */}
      {auctions.length === 0 && !loading && (
        <Card className="p-5 border-dashed">
          <div className="text-center space-y-2">
            <TrendingUp className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="font-body text-xs text-muted-foreground">
              No auction data yet — click "Run Scrape" to collect pricing
              benchmarks from Phillips, Christie's, Piasa & Sotheby's
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
