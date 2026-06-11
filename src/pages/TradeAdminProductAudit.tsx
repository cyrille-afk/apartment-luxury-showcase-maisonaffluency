/**
 * Product Sheet Audit — no iframes/popups.
 * Renders Public vs Trade product-sheet previews directly from data so the
 * Lovable editor cannot blank them out.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const TRADE_DISCOUNT = 0.08;

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function money(cents: number | null | undefined, currency = "EUR") {
  if (!cents || cents <= 0) return "Price on Request";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function firstImage(product: any, tradeProduct?: any) {
  const gallery = Array.isArray(product?.gallery_images) && product.gallery_images.length
    ? product.gallery_images
    : Array.isArray(tradeProduct?.gallery_images) && tradeProduct.gallery_images.length
      ? tradeProduct.gallery_images
      : [];
  return product?.image_url || gallery[0] || tradeProduct?.image_url || null;
}

function allImages(product: any, tradeProduct?: any) {
  return [
    product?.image_url,
    ...(Array.isArray(product?.gallery_images) ? product.gallery_images : []),
    product?.hover_image_url,
    tradeProduct?.image_url,
    ...(Array.isArray(tradeProduct?.gallery_images) ? tradeProduct.gallery_images : []),
  ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
}

function variantLabel(v: any) {
  return [v?.base, v?.top, v?.size, v?.label].filter(Boolean).join(" · ") || "Variant";
}

type Row = {
  id: string;
  title: string;
  subtitle: string | null;
  designerSlug: string | null;
  designerName: string;
  productSlug: string;
};

function AuditPane({
  side,
  tone,
  product,
  designer,
  tradeProduct,
  url,
}: {
  side: "Public" | "Trade";
  tone: string;
  product: any;
  designer: any;
  tradeProduct?: any;
  url: string | null;
}) {
  const isTrade = side === "Trade";
  const currency = tradeProduct?.currency || product?.currency || "EUR";
  const rrp = tradeProduct?.rrp_price_cents || tradeProduct?.trade_price_cents || product?.trade_price_cents || null;
  const tradePrice = rrp ? Math.round(rrp * (1 - TRADE_DISCOUNT)) : null;
  const images = allImages(product, tradeProduct);
  const hero = firstImage(product, tradeProduct);
  const variants = Array.isArray(product?.size_variants) ? product.size_variants : [];
  const specSheet = tradeProduct?.spec_sheet_url || product?.pdf_url || (Array.isArray(product?.pdf_urls) ? product.pdf_urls[0]?.url : null);

  return (
    <Card className="overflow-hidden bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">{side} view</div>
          <div className="text-xs text-muted-foreground">{tone}</div>
          {url && <div className="mt-2 break-all text-[11px] text-muted-foreground/80">{url}</div>}
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline">
            Open tab <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="max-h-[calc(100vh-245px)] min-h-[680px] overflow-auto">
        <div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]">
          <div className="space-y-3">
            <div className="aspect-[4/5] overflow-hidden rounded-md bg-muted">
              {hero ? (
                <img src={hero} alt={`${product.title} preview`} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {images.map((src: string) => (
                  <div key={src} className="aspect-square overflow-hidden rounded bg-muted">
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{designer?.name || "—"}</div>
              <h2 className="mt-2 text-3xl font-light leading-tight">{product.title}</h2>
              {product.subtitle && <p className="mt-1 text-sm text-muted-foreground">{product.subtitle}</p>}
            </div>

            <div className="border-y border-border py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Price</div>
              {isTrade ? (
                <div className="mt-2 space-y-1">
                  <div className="text-2xl font-light">{money(tradePrice, currency)}</div>
                  {rrp ? <div className="text-sm text-muted-foreground line-through">RRP {money(rrp, currency)}</div> : null}
                  {rrp ? <div className="text-xs text-muted-foreground">8% trade discount applied</div> : null}
                </div>
              ) : (
                <div className="mt-2 text-2xl font-light">Price on Request</div>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Materials</dt><dd className="mt-1">{product.materials || tradeProduct?.materials || "—"}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Dimensions</dt><dd className="mt-1 whitespace-pre-line">{product.dimensions || tradeProduct?.dimensions || "—"}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Lead time</dt><dd className="mt-1">{product.lead_time || tradeProduct?.lead_time || "—"}</dd></div>
              <div><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Origin</dt><dd className="mt-1">{product.origin || tradeProduct?.origin || "—"}</dd></div>
            </dl>

            {variants.length > 0 && (
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Variants</div>
                <div className="max-h-52 overflow-auto rounded-md border border-border">
                  {variants.slice(0, 30).map((v: any, idx: number) => {
                    const cents = isTrade && v?.price_cents ? Math.round(v.price_cents * (1 - TRADE_DISCOUNT)) : null;
                    return (
                      <div key={`${variantLabel(v)}-${idx}`} className="flex items-start justify-between gap-3 border-b border-border px-3 py-2 last:border-0">
                        <span className="text-sm">{variantLabel(v)}</span>
                        <span className="shrink-0 text-sm text-muted-foreground">{isTrade ? money(cents, currency) : "Price on Request"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">Description</div>
              <p className="text-sm leading-6 text-muted-foreground">{product.description || tradeProduct?.description || "No description."}</p>
            </div>

            <div className="rounded-md border border-border p-3 text-sm">
              <div className="font-medium">Documentation</div>
              <div className="mt-1 text-muted-foreground">
                {isTrade
                  ? specSheet ? "Spec sheet available to trade users." : "No trade spec sheet linked."
                  : specSheet ? "Documentation gated behind registration." : "No public documentation linked."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function TradeAdminProductAudit() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));

  const rowsQuery = useQuery({
    queryKey: ["audit-picks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("id, title, subtitle, designer_id, designers:designer_id(name, slug)")
        .order("title");
      if (error) throw error;
      return (data || []).map((p: any): Row => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        designerSlug: p.designers?.slug ?? null,
        designerName: p.designers?.name ?? "—",
        productSlug: slugify(p.title + (p.subtitle ? `-${p.subtitle}` : "")),
      }));
    },
  });

  const rows = rowsQuery.data || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows.slice(0, 200);
    return rows.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.designerName.toLowerCase().includes(q) ||
      (r.subtitle || "").toLowerCase().includes(q)
    ).slice(0, 200);
  }, [rows, query]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  useEffect(() => {
    const currentId = params.get("id");
    if (selectedId === currentId) return;
    const next = new URLSearchParams(params);
    if (selectedId) next.set("id", selectedId);
    else next.delete("id");
    setParams(next, { replace: true });
  }, [params, selectedId, setParams]);

  const detailQuery = useQuery({
    queryKey: ["audit-product-detail", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data: pick, error } = await supabase
        .from("designer_curator_picks")
        .select("id, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, price_per_sqm_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, variant_image_map, edition, edition_number, edition_signing, designers:designer_id(id, name, slug, display_name)")
        .eq("id", selectedId)
        .maybeSingle();
      if (error) throw error;
      if (!pick) return null;

      const brandNames = Array.from(new Set([
        (pick as any).designers?.display_name,
        (pick as any).designers?.name,
      ].filter(Boolean)));

      let tradeQuery = supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, gallery_images, materials, dimensions, description, category, subcategory, lead_time, origin, trade_price_cents, rrp_price_cents, currency, price_unit, price_prefix, spec_sheet_url, glb_url")
        .eq("product_name", (pick as any).title)
        .eq("is_active", true)
        .eq("is_hidden", false)
        .limit(1);
      if (brandNames.length === 1) tradeQuery = tradeQuery.eq("brand_name", brandNames[0] as string);
      else if (brandNames.length > 1) tradeQuery = tradeQuery.in("brand_name", brandNames as string[]);

      const { data: tradeMatches } = await tradeQuery;
      return { pick, designer: (pick as any).designers, tradeProduct: tradeMatches?.[0] || null };
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = selected?.designerSlug ? `${origin}/designers/${selected.designerSlug}/${selected.productSlug}` : null;
  const tradeUrl = selected?.designerSlug ? `${origin}/trade/products/${selected.designerSlug}/${selected.productSlug}` : selected ? `${origin}/trade/products/${selected.id}` : null;

  const reload = () => {
    void rowsQuery.refetch();
    void detailQuery.refetch();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Product Sheet Audit</h1>
          <p className="text-sm text-muted-foreground">Real in-page Public vs Trade previews. No iframes, popups, or empty preview shells.</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={!selected}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh data
        </Button>
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input placeholder="Search product or designer…" value={query} onChange={(e) => setQuery(e.target.value)} className="md:max-w-sm" />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm md:flex-1" value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value || null)}>
            <option value="">{rowsQuery.isLoading ? "Loading…" : `Select product (${filtered.length} shown)`}</option>
            {filtered.map((r) => (
              <option key={r.id} value={r.id}>{r.designerName} — {r.title}{r.subtitle ? ` (${r.subtitle})` : ""}</option>
            ))}
          </select>
        </div>
      </Card>

      {!selected ? (
        <Card className="p-12 text-center text-muted-foreground">Pick a product above to load both rendered previews side by side.</Card>
      ) : detailQuery.isLoading ? (
        <Card className="p-12 text-center text-muted-foreground">Loading product data…</Card>
      ) : !detailQuery.data ? (
        <Card className="p-12 text-center text-muted-foreground">Product data not found.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AuditPane side="Public" tone="Public sees Price on Request + gated documents" product={detailQuery.data.pick} designer={detailQuery.data.designer} tradeProduct={detailQuery.data.tradeProduct} url={publicUrl} />
          <AuditPane side="Trade" tone="Trade sees RRP, 8% discount, specs, and documentation" product={detailQuery.data.pick} designer={detailQuery.data.designer} tradeProduct={detailQuery.data.tradeProduct} url={tradeUrl} />
        </div>
      )}
    </div>
  );
}