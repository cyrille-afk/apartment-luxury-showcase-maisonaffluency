import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatMoneyIn } from "@/lib/displayMoney";
import Product3DViewer from "@/components/trade/Product3DViewer";

type Glb = { variant_label: string; glb_url: string; is_default: boolean; material_roles: any };
type Swatch = { name: string; image_url: string | null; category: string | null };
const roleOf = (cat: string | null) => {
  const c = (cat || "").toLowerCase();
  if (/fabric|leather|upholster|rug/.test(c)) return "fabric";
  if (/stone|marble|glass|ceramic/.test(c)) return "top";
  if (/wood|metal/.test(c)) return "base";
  return null;
};

export type FinishSelection = { label: string; price_cents: number | null; image_url: string | null };

type Variant = { top?: string; base?: string; label?: string; price_cents?: number; lead_time?: string };

const norm = (s?: string) => (s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
export const finishLabel = (v: Variant) =>
  [v.top, v.base].filter(Boolean).join(" / ") + (v.label ? ` · ${v.label}` : "");

export default function FinishesDrawer({
  open, onOpenChange, productId, productName, baseImage, clientMode, current, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  productName: string;
  baseImage: string | null;
  clientMode: boolean;
  current?: string | null;
  onSelect: (sel: FinishSelection) => void;
}) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [imgMap, setImgMap] = useState<Record<string, number>>({});
  const [currency, setCurrency] = useState("EUR");
  const [lead, setLead] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [glbs, setGlbs] = useState<Glb[]>([]);
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [preview, setPreview] = useState<Variant | null>(null);
  // User-picked swatches per axis (real fabric/finish names from the product
  // sheet's swatch list, which need not match variant axis labels).
  const [picked, setPicked] = useState<{ top?: Swatch; base?: Swatch }>({});

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    let alive = true;
    setLoading(true);
    (async () => {
      const { data: tp } = await supabase
        .from("trade_products")
        .select("source_pick_id, currency, lead_time, lead_time_weeks_min, lead_time_weeks_max")
        .eq("id", productId)
        .maybeSingle();
      const t: any = tp || {};
      setCurrency(t.currency || "EUR");
      setLead(t.lead_time || (t.lead_time_weeks_min ? `${t.lead_time_weeks_min}–${t.lead_time_weeks_max ?? t.lead_time_weeks_min} wks` : null));
      if (t.source_pick_id) {
        const { data: pick } = await supabase
          .from("designer_curator_picks")
          .select("size_variants, variant_image_map, gallery_images")
          .eq("id", t.source_pick_id)
          .maybeSingle();
        const [{ data: g }, { data: sw }] = await Promise.all([
          supabase.from("trade_product_glb_variants").select("variant_label, glb_url, is_default, material_roles").eq("product_id", productId),
          supabase.from("product_fabric_swatches_public").select("name, image_url, category").eq("pick_id", t.source_pick_id),
        ]);
        if (alive) { setGlbs((g as Glb[]) || []); setSwatches((sw as Swatch[]) || []); }
        const p: any = pick || {};
        if (!alive) return;
        setVariants(Array.isArray(p.size_variants) ? p.size_variants.filter((v: Variant) => v.top || v.base) : []);
        setImgMap(p.variant_image_map || {});
        setGallery(p.gallery_images || []);
      } else setVariants([]);
      if (!clientMode) {
        const { data } = await supabase.rpc("current_trade_discount_pct" as any);
        setDiscount(Number(data) || 0);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [open, productId, clientMode]);

  const imageFor = (v: Variant | null) => {
    if (!v) return null;
    const keys = [
      [norm(v.base), norm(v.top), norm(v.label)].join("|"),
      [norm(v.base), norm(v.top)].join("|"),
      norm(v.top), norm(v.base),
    ];
    for (const k of keys) if (k in imgMap && gallery[imgMap[k]]) return gallery[imgMap[k]];
    return null;
  };

  // Resolve a variant's top/base material names to their pre-cropped swatch
  // assets (same product_fabric_swatches_public source as Felix Chat).
  const swatchFor = (name?: string) => {
    if (!name) return null;
    return (
      swatches.find((s) => norm(s.name) === norm(name)) ||
      swatches.find((s) => norm(name).includes(norm(s.name)) || norm(s.name).includes(norm(name))) ||
      null
    );
  };

  const activeVariant = preview ?? variants.find((v) => finishLabel(v) === current) ?? variants[0] ?? null;
  const trade = activeVariant?.price_cents ? Math.round(activeVariant.price_cents * (1 - discount / 100)) : null;
  const glb = useMemo(() => {
    if (!glbs.length) return null;
    const lbl = norm(activeVariant?.label);
    return (lbl && glbs.find((g) => norm(g.variant_label) === lbl)) || glbs.find((g) => g.is_default) || glbs[0];
  }, [glbs, activeVariant]);
  const textures = useMemo(() => {
    const out: { fabric?: string; base?: string; top?: string } = {};
    [activeVariant?.top, activeVariant?.base].forEach((m, i) => {
      if (!m) return;
      const sw = swatches.find((s) => norm(s.name) === norm(m)) || swatches.find((s) => norm(m).includes(norm(s.name)) || norm(s.name).includes(norm(m)));
      if (!sw?.image_url) return;
      const r = roleOf(sw.category) || (i === 0 ? "top" : "base");
      (out as any)[r] = sw.image_url;
    });
    // Explicitly picked swatches win over variant-derived textures.
    if (picked.top?.image_url) out.fabric = picked.top.image_url;
    if (picked.base?.image_url) out.base = picked.base.image_url;
    return out;
  }, [activeVariant, swatches, picked]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none border-l border-border/60 bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-6 text-left">
          <p className="font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Materials & Finishes Library</p>
          <SheetTitle className="font-display text-xl font-normal">{productName}</SheetTitle>
          <SheetDescription className="font-body text-xs">
            {clientMode ? "Select a finish to preview it on this piece." : "Swapping a finish updates cost, margin and lead time in the matrix."}
          </SheetDescription>
        </SheetHeader>

        {/* Top half — single preview workspace (3D model when available, else high-res image) */}
        {glb ? (
          <div className="border-b border-border/60 bg-[hsl(var(--product-canvas))]">
            <Product3DViewer
              key={glb.glb_url}
              url={glb.glb_url}
              alt={productName}
              poster={baseImage}
              fabricTextureUrl={textures.fabric ?? null}
              baseTextureUrl={textures.base ?? null}
              topTextureUrl={textures.top ?? null}
              materialRoles={glb.material_roles || undefined}
              autoOpen
            />
          </div>
        ) : (
          <div className="border-b border-border/60 bg-[hsl(var(--product-canvas))]">
            <div className="aspect-[4/3] w-full flex items-center justify-center">
              {(imageFor(activeVariant) || baseImage) ? (
                <img src={imageFor(activeVariant) || baseImage || ""} alt={productName} className="h-full w-full object-contain p-4" />
              ) : (
                <span className="font-body text-xs text-muted-foreground">No image available</span>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <p className="px-6 py-10 font-body text-xs text-muted-foreground">Loading finishes…</p>
        ) : variants.length === 0 ? (
          <p className="px-6 py-10 font-body text-xs text-muted-foreground">No alternative finishes are catalogued for this piece.</p>
        ) : (
          <>
            {/* Swatch sections — the exact linked finish list from the product
                sheet (product_fabric_swatches_public), with name labels and
                pre-cropped images. Falls back to variant-axis names only when
                a section has no linked swatches. */}
            {([
              { key: "top" as const, title: "Upholstery" },
              { key: "base" as const, title: "Frame Finish" },
            ]).map(({ key, title }) => {
              const linked = swatches.filter((s) => (key === "top" ? roleOf(s.category) === "fabric" : roleOf(s.category) === "base"));
              const axisOpts = Array.from(new Map(variants.filter((v) => v[key]).map((v) => [norm(v[key]), v[key] as string])).values());
              if (!linked.length && !axisOpts.length) return null;
              return (
                <div key={key} className="border-b border-border/60 px-6 py-5">
                  <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {title} <span className="normal-case tracking-normal">({linked.length || axisOpts.length})</span>
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {(linked.length ? linked : axisOpts.map((name) => ({ name, image_url: swatchFor(name)?.image_url || null, category: null }))).map((sw) => {
                      const isActive = norm(picked[key]?.name) === norm(sw.name) || (!picked[key] && norm(activeVariant?.[key]) === norm(sw.name));
                      return (
                        <button
                          key={sw.name}
                          type="button"
                          onClick={() => {
                            setPicked((p) => ({ ...p, [key]: sw }));
                            const other = key === "top" ? "base" : "top";
                            const v =
                              variants.find((x) => norm(x[key]) === norm(sw.name) && norm(x[other]) === norm(activeVariant?.[other])) ||
                              variants.find((x) => norm(x[key]) === norm(sw.name));
                            if (v) {
                              setPreview(v);
                              onSelect({ label: finishLabel(v), price_cents: v.price_cents ?? null, image_url: imageFor(v) });
                            } else if (activeVariant) {
                              const merged = { ...activeVariant, [key]: sw.name };
                              setPreview(merged);
                              onSelect({ label: finishLabel(merged), price_cents: merged.price_cents ?? null, image_url: imageFor(merged) });
                            }
                          }}
                          className="text-left"
                        >
                          <span className={`block aspect-square overflow-hidden border transition-all ${isActive ? "border-primary ring-1 ring-primary ring-offset-1 ring-offset-background" : "border-border/60 hover:border-foreground/40"}`}>
                            {sw.image_url ? (
                              <img src={sw.image_url} alt={sw.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center bg-muted/40 px-1 text-center font-body text-[9px] text-muted-foreground">{sw.name}</span>
                            )}
                          </span>
                          <span className={`mt-1.5 block font-body text-[11px] leading-tight ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>{sw.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}


            {/* Single state-driven metadata card */}
            {activeVariant && (
              <div className="px-6 py-6">
                {/* Identity layer */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-12 w-12 shrink-0 bg-[hsl(var(--product-canvas))]">
                    {(imageFor(activeVariant) || baseImage) && (
                      <img src={imageFor(activeVariant) || baseImage || ""} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-foreground leading-tight">
                      {[activeVariant.top, activeVariant.base].filter(Boolean).join(" / ")}
                    </p>
                    {activeVariant.label && (
                      <p className="mt-0.5 font-body text-[11px] text-muted-foreground">{activeVariant.label}</p>
                    )}
                  </div>
                </div>

                {/* Price & Logistics Breakdown Grid */}
                <div className={`grid gap-x-4 gap-y-3 ${clientMode ? "grid-cols-1" : "grid-cols-3"}`}>
                  <div>
                    <p className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Client Price</p>
                    <p className="font-display text-base tabular-nums text-primary">
                      {formatMoneyIn(activeVariant.price_cents ?? null, currency, "Price upon Request")}
                    </p>
                  </div>
                  {!clientMode && (
                    <>
                      <div>
                        <p className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Trade</p>
                        <p className="font-body text-sm tabular-nums text-foreground">{formatMoneyIn(trade, currency, "—")}</p>
                        <p className="font-body text-[10px] tabular-nums text-muted-foreground">Margin {discount}%</p>
                      </div>
                      <div>
                        <p className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Lead Time</p>
                        <p className="font-body text-sm text-foreground">{activeVariant.lead_time || lead || "—"}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
