/**
 * Priced tear sheet shown after a Visualiser render completes.
 *
 * Lists every pinned material/finish (fabric library) and product hint
 * (axonometric studio imports) from the rendered scene, enriched with the
 * dimensions / lead time / trade price we have on file, and exposes
 * per-line + scene-level "Request priced spec sheet" CTAs that open the
 * existing CustomRequestModal pre-filled with the scene context.
 */
import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Ruler, Clock, Sparkles, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import CustomRequestModal from "@/components/trade/CustomRequestModal";

type Surface = "walls" | "floors" | "upholstery" | "curtains" | "furniture";

type Swatch = {
  id: string;
  name: string;
  supplier: string | null;
  image_url: string | null;
  category: string | null;
  tier: string | null;
};

type ProductHint = {
  name: string;
  image_url: string | null;
  brand: string | null;
};

export type TearSheetPin = {
  id: string;
  surface: Surface;
  swatch?: Swatch;
  productHint?: ProductHint;
};

type EnrichedProduct = {
  id?: string | null;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  dimensions: string | null;
  lead_time: string | null;
  materials: string | null;
  trade_price_cents: number | null;
  currency: string | null;
  price_prefix: string | null;
};

type Line = {
  key: string;
  surface: Surface;
  kind: "finish" | "product";
  image: string | null;
  title: string;
  subtitle: string | null;
  dimensions: string | null;
  leadTime: string | null;
  materials: string | null;
  priceLabel: string;
  enriched?: EnrichedProduct;
};

const SURFACE_LABEL: Record<Surface, string> = {
  walls: "Walls",
  floors: "Floors",
  upholstery: "Upholstery",
  curtains: "Curtains",
  furniture: "Furniture",
};

const formatPrice = (cents: number | null, currency: string | null, prefix: string | null): string => {
  if (!cents || cents <= 0) return "Price on Request";
  const cur = (currency || "EUR").toUpperCase();
  try {
    const v = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(cents / 100);
    return prefix ? `${prefix} ${v}` : v;
  } catch {
    return "Price on Request";
  }
};

const tierLabel = (tier: string | null) =>
  tier ? `Price band CAT ${tier.toUpperCase()}` : "Price on Request";

export function VisualiserTearSheet({
  pins,
  renderedImage,
}: {
  pins: TearSheetPin[];
  renderedImage: string | null;
}) {
  const [enrichments, setEnrichments] = useState<Record<string, EnrichedProduct | null>>({});
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<{ id?: string | null; product_name: string; brand_name?: string | null } | null>(null);

  const usedPins = useMemo(
    () => pins.filter((p) => p.swatch || p.productHint),
    [pins],
  );

  // Look up trade_products for any productHint so we can show real dimensions,
  // lead time, materials and trade price (rather than just the bare label).
  useEffect(() => {
    const hints = usedPins
      .filter((p) => p.productHint)
      .map((p) => p.productHint!.name)
      .filter(Boolean);
    if (hints.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("designer_curator_picks_public")
        .select(
          "id, title, subtitle, image_url, dimensions, lead_time, materials, trade_price_cents, currency, price_prefix",
        )
        .in("title", hints);
      if (cancelled) return;
      const byTitle = new Map<string, EnrichedProduct>();
      for (const r of (data ?? []) as Array<Record<string, any>>) {
        byTitle.set(String(r.title || "").toLowerCase(), {
          id: r.id,
          product_name: r.title,
          brand_name: r.subtitle ?? null,
          image_url: r.image_url ?? null,
          dimensions: r.dimensions ?? null,
          lead_time: r.lead_time ?? null,
          materials: r.materials ?? null,
          trade_price_cents: r.trade_price_cents ?? null,
          currency: r.currency ?? null,
          price_prefix: r.price_prefix ?? null,
        });
      }
      const next: Record<string, EnrichedProduct | null> = {};
      for (const p of usedPins) {
        if (!p.productHint) continue;
        next[p.id] = byTitle.get(p.productHint.name.toLowerCase()) ?? null;
      }
      setEnrichments(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [usedPins]);

  const lines: Line[] = useMemo(() => {
    return usedPins.map((p) => {
      if (p.productHint) {
        const e = enrichments[p.id];
        return {
          key: p.id,
          surface: p.surface,
          kind: "product",
          image: e?.image_url || p.productHint.image_url,
          title: p.productHint.name,
          subtitle: p.productHint.brand,
          dimensions: e?.dimensions ?? null,
          leadTime: e?.lead_time ?? null,
          materials: e?.materials ?? null,
          priceLabel: e
            ? formatPrice(e.trade_price_cents, e.currency, e.price_prefix)
            : "Price on Request",
          enriched: e ?? undefined,
        };
      }
      const sw = p.swatch!;
      return {
        key: p.id,
        surface: p.surface,
        kind: "finish",
        image: sw.image_url,
        title: sw.name,
        subtitle: sw.supplier,
        dimensions: null,
        leadTime: null,
        materials: sw.category,
        priceLabel: tierLabel(sw.tier),
      };
    });
  }, [usedPins, enrichments]);

  if (lines.length === 0) return null;

  const openLineInquiry = (line: Line) => {
    setModalProduct({
      id: line.enriched?.id || null,
      product_name: line.title,
      brand_name: line.subtitle || line.enriched?.brand_name || null,
    });
    setModalOpen(true);
  };

  const openSceneInquiry = () => {
    const summary = lines
      .map(
        (l, i) =>
          `${i + 1}. [${SURFACE_LABEL[l.surface]}] ${l.title}${l.subtitle ? ` — ${l.subtitle}` : ""} (${l.priceLabel})`,
      )
      .join(" · ");
    setModalProduct({
      id: null,
      product_name: `Visualiser scene — ${lines.length} item${lines.length === 1 ? "" : "s"}`,
      brand_name: summary.slice(0, 240),
    });
    setModalOpen(true);
  };

  return (
    <>
      <section
        aria-labelledby="visualiser-tearsheet-heading"
        className="mt-6 rounded-xl border border-border bg-card"
      >
        <header className="flex items-start justify-between gap-4 p-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-3.5 w-3.5 text-[hsl(var(--gold))]" />
              <span className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Priced tear sheet
              </span>
            </div>
            <h2 id="visualiser-tearsheet-heading" className="font-display text-lg">
              The scene, specified.
            </h2>
            <p className="font-body text-xs text-muted-foreground mt-1 max-w-xl">
              Selected materials, dimensions, lead times and trade pricing from the render.
              Request a fully priced spec sheet for the whole room, or item by item.
            </p>
          </div>
          <Button onClick={openSceneInquiry} size="sm" className="shrink-0">
            <Send className="h-4 w-4 mr-2" />
            Request priced spec sheet
          </Button>
        </header>

        {loading && (
          <div className="flex items-center gap-2 px-5 py-2 text-xs text-muted-foreground border-b border-border">
            <Loader2 className="h-3 w-3 animate-spin" />
            Looking up catalogue pricing…
          </div>
        )}

        <ul className="divide-y divide-border">
          {lines.map((l) => (
            <li key={l.key} className="flex gap-4 p-4 items-start">
              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0 border border-border">
                {l.image && (
                  <img
                    src={l.image}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {SURFACE_LABEL[l.surface]} · {l.kind === "finish" ? "Finish" : "Piece"}
                  </span>
                </div>
                <p className="font-display text-sm text-foreground truncate">{l.title}</p>
                {l.subtitle && (
                  <p className="font-body text-xs text-muted-foreground truncate">{l.subtitle}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-body">
                  {l.dimensions && (
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="h-3 w-3" /> {l.dimensions}
                    </span>
                  )}
                  {l.leadTime && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {l.leadTime}
                    </span>
                  )}
                  {l.materials && !l.dimensions && (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> {l.materials}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                <span className="font-display text-sm text-foreground">{l.priceLabel}</span>
                <button
                  type="button"
                  onClick={() => openLineInquiry(l)}
                  className="font-body text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Request pricing
                </button>
              </div>
            </li>
          ))}
        </ul>

        <footer className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
          <p className="font-body text-[11px] text-muted-foreground italic">
            Trade pricing shown net of your tier discount. Final landed cost confirmed on quotation.
          </p>
          {renderedImage && (
            <a
              href={renderedImage}
              download="visualiser-render.png"
              className="font-body text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Download render
            </a>
          )}
        </footer>
      </section>

      {modalProduct && (
        <CustomRequestModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          product={modalProduct}
        />
      )}
    </>
  );
}

export default VisualiserTearSheet;
