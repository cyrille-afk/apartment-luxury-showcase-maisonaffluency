/** Pure data mapping for Specification Sheet Generator cards (screen + PDF share it). */
type Variant = { label?: string | null; base?: string | null; top?: string | null; price_cents?: number | null };
export type SpecProductSource = {
  dimensions?: string | null; width_mm?: number | null; depth_mm?: number | null; height_mm?: number | null;
  size_variants?: Variant[] | null; default_variant_label?: string | null;
  rrp_price_cents?: number | null; available_finishes?: string[] | null; materials?: string | null;
  description?: string | null; materials_description?: string | null; meta_description?: string | null;
};

export const SPEC_DIMENSIONS_PLACEHOLDER = "Dimensions on file";

const num = (v: string) => Number(v.replace(",", "."));
const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** Format a recorded string as `W 90 × D 92 × H 78 cm` / `Ø 40.5 × H 47 cm`; null when unparseable. */
export function formatSpecDimensionString(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/(\d),(\d)/g, "$1.$2");
  const mm = /\bmm\b/i.test(t) && !/\bcm\b/i.test(t);
  const conv = (v: string) => fmt(mm ? num(v) / 10 : num(v));
  const w = t.match(/\bW\s*([\d.]+)/i), d = t.match(/\bD\s*([\d.]+)/i);
  const h = t.match(/(?:^|[\s×xX,(—–-])H\s*([\d.]+)/), dia = t.match(/[ØøΦ]\s*([\d.]+)/);
  if (w && d && h) return `W ${conv(w[1])} × D ${conv(d[1])} × H ${conv(h[1])} cm`;
  if (dia && h) return `Ø ${conv(dia[1])} × H ${conv(h[1])} cm`;
  if (w && h) return `W ${conv(w[1])} × H ${conv(h[1])} cm`;
  const tri = t.match(/([\d.]+)\s*[×xX]\s*([\d.]+)\s*[×xX]\s*H?\s*([\d.]+)\s*(mm|cm)?/i);
  if (tri) { const f = (v: string) => fmt(tri[4]?.toLowerCase() === "mm" ? num(v) / 10 : num(v)); return `W ${f(tri[1])} × D ${f(tri[2])} × H ${f(tri[3])} cm`; }
  return null;
}

function defaultVariant(p: SpecProductSource): Variant | undefined {
  const vs = p.size_variants || [];
  return vs.find(v => p.default_variant_label && v.label?.trim() === p.default_variant_label.trim()) || vs[0];
}

export function specDimensions(p: SpecProductSource): string {
  // The priced default variant's size wins so dimensions match the price shown.
  const dv = defaultVariant(p);
  const fromVariant = dv && (formatSpecDimensionString(dv.label) || formatSpecDimensionString(dv.base) || formatSpecDimensionString(dv.top));
  if (fromVariant) return fromVariant;
  const fromText = formatSpecDimensionString(p.dimensions);
  if (fromText) return fromText;
  if (p.width_mm && p.depth_mm && p.height_mm) return `W ${fmt(p.width_mm / 10)} × D ${fmt(p.depth_mm / 10)} × H ${fmt(p.height_mm / 10)} cm`;
  for (const v of p.size_variants || []) { const f = formatSpecDimensionString(v.label) || formatSpecDimensionString(v.base) || formatSpecDimensionString(v.top); if (f) return f; }
  return p.dimensions?.trim() || SPEC_DIMENSIONS_PLACEHOLDER;
}

/** Client price: RRP, else the default variant's RRP, else the quoted unit price. Never net trade. */
export function specClientPriceCents(p: SpecProductSource, quotedUnitCents?: number | null): number | null {
  const v = defaultVariant(p)?.price_cents;
  return [p.rrp_price_cents, v, quotedUnitCents].find((c): c is number => typeof c === "number" && c > 0) ?? null;
}

/** Active/default finish names, used for both the label and the swatches. */
export function specFinishes(p: SpecProductSource): string[] {
  const v = defaultVariant(p);
  const fromVariant = [v?.base, v?.top].map(s => s?.trim()).filter((s): s is string => !!s && !formatSpecDimensionString(s));
  if (fromVariant.length) return [...new Set(fromVariant)];
  if (p.available_finishes?.length) return [p.available_finishes[0]];
  return (p.materials || "").split(/,|\/| and /).map(s => s.trim()).filter(Boolean).slice(0, 3);
}

const SEO = /(\s*[|–-]\s*(Maison Affluency|Shop|Buy|Trade).*$)|(^\s*(Shop|Buy|Discover)\s+)/i;
export function cleanSpecDescription(p: SpecProductSource): string {
  const clean = (s?: string | null) => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const editorial = clean(p.description) || clean(p.materials_description);
  if (editorial) return editorial;
  return clean(p.meta_description).replace(SEO, "").trim();
}
