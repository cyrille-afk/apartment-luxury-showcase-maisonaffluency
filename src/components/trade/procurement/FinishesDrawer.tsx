import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatMoneyIn } from "@/lib/displayMoney";
import Product3DViewer from "@/components/trade/Product3DViewer";

type Glb = { variant_label: string; glb_url: string; is_default: boolean; material_roles: any };
type Swatch = { name: string; image_url: string | null; category: string | null; price_tier_label?: string | null };
const roleOf = (cat: string | null) => {
  const c = (cat || "").toLowerCase();
  if (/fabric|leather|upholster|rug/.test(c)) return "fabric";
  if (/stone|marble|glass|ceramic/.test(c)) return "top";
  if (/wood|metal/.test(c)) return "base";
  return null;
};

export type FinishSelection = { label: string; price_cents: number | null; image_url: string | null; top?: string | null; base?: string | null; top_image?: string | null; base_image?: string | null };

const normKey = (s?: string | null) => (s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
const variantImage = (v: any, imgMap: Record<string, number>, gallery: string[]) => {
  if (!v) return null;
  const keys = [
    [normKey(v.base), normKey(v.top), normKey(v.label)].join("|"),
    [normKey(v.base), normKey(v.top)].join("|"),
    normKey(v.top), normKey(v.base),
  ];
  for (const k of keys) if (k in imgMap && gallery[imgMap[k]]) return gallery[imgMap[k]];
  return null;
};

/** Map a real fabric name (e.g. "Aries Pietra", "Safire-2 0006") or its
 *  price tier to the priced variant category ("Fabric Cat. Aries"). */
export const categoryKey = (top?: string | null) => normKey(top).replace(/^(fabric|leather)cat/, "");
export const matchTopVariant = <V extends { top?: string; base?: string }>(variants: V[], fabric?: string | null, base?: string | null, tier?: string | null): V | null => {
  if (!fabric && !tier) return null;
  const f = normKey(fabric), t = normKey(tier);
  const pool = base ? variants.filter((v) => normKey(v.base) === normKey(base)) : variants;
  const scored = (pool.length ? pool : variants)
    .map((v) => ({ v, k: categoryKey(v.top) }))
    .filter(({ v, k }) => k && (normKey(v.top) === f || (t && (normKey(v.top) === t || categoryKey(tier) === k)) || f.startsWith(k)))
    .sort((a, b) => b.k.length - a.k.length);
  return scored[0]?.v ?? null;
};

/** Resolve each board item's saved finish (variant_label + fabric/wood labels)
 *  to the same price & image the drawer shows, so cards match on load. */
export async function resolveSavedFinishes(
  items: { id: string; product_id: string; variant_label?: string | null; fabric_label?: string | null; wood_label?: string | null }[],
): Promise<Record<string, FinishSelection>> {
  const withSel = items.filter((i) => i.variant_label || i.fabric_label || i.wood_label);
  if (!withSel.length) return {};
  const { data: tps } = await supabase.from("trade_products").select("id, source_pick_id").in("id", Array.from(new Set(withSel.map((i) => i.product_id))));
  const pickOf = new Map((tps || []).map((t: any) => [t.id, t.source_pick_id as string | null]));
  const pickIds = Array.from(new Set((tps || []).map((t: any) => t.source_pick_id).filter(Boolean)));
  if (!pickIds.length) return {};
  const [{ data: picks }, { data: sws }] = await Promise.all([
    supabase.from("designer_curator_picks").select("id, size_variants, variant_image_map, gallery_images").in("id", pickIds),
    supabase.from("product_fabric_swatches_public").select("pick_id, name, image_url, category, price_tier_label").in("pick_id", pickIds),
  ]);
  const pickMap = new Map((picks || []).map((p: any) => [p.id, p]));
  const out: Record<string, FinishSelection> = {};
  for (const it of withSel) {
    const pid = pickOf.get(it.product_id);
    const p: any = pid && pickMap.get(pid);
    if (!p) continue;
    out[it.id] = resolveFinishFrom(it, p, (sws || []).filter((x: any) => x.pick_id === pid));
  }
  return out;
}

/** Pure resolver: saved labels + catalogue data → price, image and chip swatches. */
export function resolveFinishFrom(
  it: { variant_label?: string | null; fabric_label?: string | null; wood_label?: string | null },
  p: { size_variants?: any; variants?: any; variant_image_map?: any; gallery_images?: any },
  sws: any[],
): FinishSelection {
  const raw = p.variants ?? p.size_variants;
  const variants: any[] = Array.isArray(raw) ? raw.filter((v: any) => v.top || v.base) : [];
  const lbl = it.variant_label || "";
  const [pair] = lbl.split(" · ");
  const [lt, lb] = (pair || "").split(" / ");
  const top = it.fabric_label || lt || null;
  const base = it.wood_label || lb || null;
  const sw: any = sws.find((x: any) => normKey(x.name) === normKey(top));
  const swBase: any = sws.find((x: any) => normKey(x.name) === normKey(base));
  const v =
    variants.find((x) => normKey(x.top) === normKey(top) && normKey(x.base) === normKey(base)) ||
    matchTopVariant(variants, top, base, sw?.price_tier_label) ||
    variants.find((x) => finishLabel(x) === lbl) ||
    variants.find((x) => normKey(x.top) === normKey(lt) && normKey(x.base) === normKey(lb)) ||
    variants.find((x) => normKey(x.base) === normKey(base)) ||
    null;
  const im = p.variant_image_map || {}, gal = p.gallery_images || [];
  const img = variantImage(v ? { ...v, top: v.top, base: base || v.base } : { top, base }, im, gal) || variantImage(v, im, gal);
  return {
    label: [top, base].filter(Boolean).join(" / ") || lbl,
    price_cents: v?.price_cents ?? null,
    image_url: img,
    top, base,
    top_image: sw?.image_url ?? null,
    base_image: swBase?.image_url ?? null,
  };
}

export type PreloadedFinishes = { variants: any[]; variant_image_map: any; gallery_images: string[]; swatches: Swatch[]; glbs: Glb[]; currency: string; lead: string | null };


type Variant = { top?: string; base?: string; label?: string; price_cents?: number; lead_time?: string };

const norm = (s?: string) => (s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
export const finishLabel = (v: Variant) =>
  [v.top, v.base].filter(Boolean).join(" / ") + (v.label ? ` · ${v.label}` : "");

export default function FinishesDrawer({
  open, onOpenChange, productId, productName, baseImage, clientMode, current, initialTop, initialBase, onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  productName: string;
  baseImage: string | null;
  clientMode: boolean;
  current?: string | null;
  initialTop?: string | null;
  initialBase?: string | null;
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
  const [openAxis, setOpenAxis] = useState<"top" | "base" | null>(null);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setPicked({});
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
          supabase.from("product_fabric_swatches_public").select("name, image_url, category, price_tier_label").eq("pick_id", t.source_pick_id),
        ]);
        if (alive) {
          const list = (sw as Swatch[]) || [];
          setGlbs((g as Glb[]) || []); setSwatches(list);
          const find = (n?: string | null, role?: string) => n ? (list.find((x) => roleOf(x.category) === role && norm(x.name) === norm(n)) || null) : null;
          const t0 = find(initialTop, "fabric"), b0 = find(initialBase, "base");
          if (t0 || b0) setPicked({ ...(t0 ? { top: t0 } : {}), ...(b0 ? { base: b0 } : {}) });
        }
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
    return variantImage(v, imgMap, gallery);
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

  const activeVariant = preview
    ?? variants.find((v) => finishLabel(v) === current)
    ?? (() => {
      const [pair] = (current || "").split(" · ");
      const [ct, cb] = pair.split(" / ");
      const t = initialTop || ct, b = initialBase || cb;
      const hit = variants.find((v) => norm(v.top) === norm(t) && norm(v.base) === norm(b)) || matchTopVariant(variants, t, b) || variants.find((v) => norm(v.base) === norm(b));
      return hit ? { ...hit, top: t || hit.top, base: b || hit.base } : null;
    })()
    ?? variants[0] ?? null;
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
            {/* Compact dropdowns — same linked finish list as the product
                sheet (product_fabric_swatches_public), one dropdown per axis.
                Falls back to variant-axis names when no swatches are linked. */}
            <div className="border-b border-border/60 px-6 py-5 space-y-4">
              {([
                { key: "top" as const, title: "Upholstery" },
                { key: "base" as const, title: "Frame Finish" },
              ]).map(({ key, title }) => {
                const linked = swatches.filter((s) => (key === "top" ? roleOf(s.category) === "fabric" : roleOf(s.category) === "base"));
                const axisOpts = Array.from(new Map(variants.filter((v) => v[key]).map((v) => [norm(v[key]), v[key] as string])).values());
                const opts: Swatch[] = linked.length ? linked : axisOpts.map((name) => ({ name, image_url: swatchFor(name)?.image_url || null, category: null }));
                if (!opts.length) return null;
                const selected = picked[key] || opts.find((o) => norm(o.name) === norm(activeVariant?.[key])) || null;
                const isOpen = openAxis === key;
                const choose = (sw: Swatch) => {
                  setPicked((p) => ({ ...p, [key]: sw }));
                  setOpenAxis(null);
                  const other = key === "top" ? "base" : "top";
                  const otherName = picked[other]?.name || activeVariant?.[other];
                  const fabricName = key === "top" ? sw.name : picked.top?.name || activeVariant?.top;
                  const tier = key === "top" ? sw.price_tier_label : picked.top?.price_tier_label;
                  const baseName = key === "base" ? sw.name : otherName;
                  const v =
                    variants.find((x) => norm(x[key]) === norm(sw.name) && norm(x[other]) === norm(otherName)) ||
                    matchTopVariant(variants, fabricName, baseName, tier) ||
                    variants.find((x) => norm(x[key]) === norm(sw.name));
                   const imgFor = (axis: "top" | "base", name?: string | null): string | null =>
                     (axis === key ? sw.image_url : null) ??
                     (picked[axis] && norm(picked[axis]!.name) === norm(name ?? undefined) ? picked[axis]!.image_url : null) ??
                     swatchFor(name ?? undefined)?.image_url ?? null;
                   if (v) {
                     const shown = { ...v, [key]: sw.name, [other]: otherName || v[other] };
                     setPreview(shown);
                     onSelect({ label: [shown.top, shown.base].filter(Boolean).join(" / "), price_cents: v.price_cents ?? null, image_url: imageFor(v), top: shown.top ?? null, base: shown.base ?? null, top_image: imgFor("top", shown.top), base_image: imgFor("base", shown.base) });
                   } else if (activeVariant) {
                     const merged = { ...activeVariant, [key]: sw.name };
                     setPreview(merged);
                     onSelect({ label: [merged.top, merged.base].filter(Boolean).join(" / "), price_cents: merged.price_cents ?? null, image_url: imageFor(merged), top: merged.top ?? null, base: merged.base ?? null, top_image: imgFor("top", merged.top), base_image: imgFor("base", merged.base) });
                   }
                };
                return (
                  <div key={key} className="relative">
                    <p className="mb-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {title} <span className="normal-case tracking-normal">({opts.length})</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpenAxis(isOpen ? null : key)}
                      className="flex w-full items-center gap-3 border border-border/60 bg-background px-3 py-2 text-left transition-colors hover:border-foreground/40"
                    >
                      <span className="h-8 w-8 shrink-0 overflow-hidden border border-border/40">
                        {selected?.image_url ? (
                          <img src={selected.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <span className="block h-full w-full bg-muted/40" />
                        )}
                      </span>
                      <span className="flex-1 truncate font-body text-xs text-foreground">{selected?.name || activeVariant?.[key] || "Select…"}</span>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-border bg-background shadow-lg">
                        {opts.map((sw) => {
                          const isActive = norm(selected?.name) === norm(sw.name);
                          return (
                            <button
                              key={sw.name}
                              type="button"
                              onClick={() => choose(sw)}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${isActive ? "bg-muted/60" : "hover:bg-muted/40"}`}
                            >
                              <span className="h-8 w-8 shrink-0 overflow-hidden border border-border/40">
                                {sw.image_url ? (
                                  <img src={sw.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <span className="block h-full w-full bg-muted/40" />
                                )}
                              </span>
                              <span className={`flex-1 truncate font-body text-xs ${isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>{sw.name}</span>
                              {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>


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
                <div className={`grid gap-x-4 gap-y-3 ${clientMode ? "grid-cols-2" : "grid-cols-3"}`}>
                  <div>
                    <p className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Client Price</p>
                    <p className="font-display text-base tabular-nums text-primary">
                      {formatMoneyIn(activeVariant.price_cents ?? null, currency, "Price upon Request")}
                    </p>
                  </div>
                  {!clientMode && (
                    <div>
                      <p className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Trade</p>
                      <p className="font-body text-sm tabular-nums text-foreground">{formatMoneyIn(trade, currency, "—")}</p>
                      <p className="font-body text-[10px] tabular-nums text-muted-foreground">Margin {discount}%</p>
                    </div>
                  )}
                  <div>
                    <p className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Lead Time</p>
                    <p className="font-body text-sm text-foreground">{activeVariant.lead_time || lead || "—"}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
