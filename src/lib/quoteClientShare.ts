import { quoteLinePricing, summarizeQuoteLines, type QuoteSummaryLine } from "./quoteLineSummary";
import { dimensionsFromVariantLabel } from "./drawerDimensions";
import { findQuoteFinishSwatch, type QuoteFinishSwatch, type QuoteFinishVariant } from "./quoteFinishSwatches";

/** A finish the client may switch to; price is retail for the line's size. */
export type SharedFinishChoice = {
  key: string;
  name: string;
  image: string | null;
  fabricId: string | null;
  variantLabel: string;
  unitCents: number | null;
  currency: string | null;
};

export type SharedQuoteLine = {
  name: string;
  maker: string | null;
  image: string | null;
  finish: string | null;
  dimensions: string | null;
  materials?: string | null;
  finishOptions?: string[];
  /** Selected finish swatches (cropped library images) recorded on the line. */
  finishSwatches?: { name: string; image: string | null }[];
  /** Quote line id, used only by the verified client finish-change RPC. */
  itemId?: string | null;
  finishLabel?: string | null;
  finishChoices?: SharedFinishChoice[];
  /** The interior designer's original choice. */
  designerFinishKey?: string | null;
  selectedFinishKey?: string | null;
  clientChanged?: boolean;
  quantity: number;
  unitCents: number | null;
  lineTotalCents: number | null;
  currency: string | null;
};

export type SharedQuoteSnapshot = {
  version: 1;
  quoteRef: string;
  clientName: string | null;
  lines: SharedQuoteLine[];
  totals: { currency: string; cents: number }[];
  lineCount: number;
  totalUnits: number;
  unpricedCount: number;
};

export type ShareSourceLine = QuoteSummaryLine & {
  id?: string | null;
  image_url?: string | null;
  fabric?: (QuoteSummaryLine["fabric"] & { name?: string | null; image_url?: string | null }) | null;
  wood_fabric?: { name?: string | null; image_url?: string | null } | null;
  product?: (QuoteSummaryLine["product"] & {
    product_name?: string | null;
    brand_name?: string | null;
    image_url?: string | null;
    dimensions?: string | null;
    materials?: string | null;
    available_finishes?: string[] | null;
    source_pick_id?: string | null;
    top_axis_label?: string | null;
    base_axis_label?: string | null;
  }) | null;
};

const fkey = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** One-letter spelling slips between price rows and swatch names (Kynos/Kyknos). */
const nearlySame = (a: string, b: string) => {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
};
const isDim = (v: string | null | undefined) => !!v && !!dimensionsFromVariantLabel(v, null);

/**
 * Finishes the client can switch between at the line's recorded size, each
 * with its own catalogue retail price and cropped library swatch.
 */
export function buildFinishChoices(item: ShareSourceLine, swatches: QuoteFinishSwatch[]): {
  choices: SharedFinishChoice[]; designerKey: string | null; label: string | null;
} {
  const variants = (item.product?.size_variants ?? []) as QuoteFinishVariant[];
  const empty = { choices: [], designerKey: null, label: null };
  if (variants.length < 2) return empty;
  const axes = ["base", "top"] as const;
  const distinct = (axis: "base" | "top") => new Set(variants.map((v) => (v[axis] || "").trim()).filter(Boolean));
  const dimAxis = axes.find((a) => distinct(a).size > 0 && [...distinct(a)].every(isDim)) ?? null;
  const finishAxis = axes.find((a) => a !== dimAxis && distinct(a).size > 1 && ![...distinct(a)].every(isDim));
  if (!finishAxis) return empty;
  const parts = (item.variant_label || "").split(" · ").map((x) => x.trim()).filter(Boolean);
  const sizePart = parts.find(isDim) ?? null;
  if (dimAxis && !sizePart) return empty;
  const rows = variants.filter((v) => !dimAxis || fkey(v[dimAxis] || "") === fkey(sizePart || ""));
  const currency = (item.product?.currency || "EUR").toUpperCase();
  const seen = new Set<string>();
  const choices: SharedFinishChoice[] = [];
  for (const row of rows) {
    for (const name of String(row[finishAxis] || "").split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean)) {
      const key = fkey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const swatch = findQuoteFinishSwatch([name], swatches)
        ?? swatches.find((sw) => sw.image_url && nearlySame(fkey(sw.name), key)) ?? null;
      choices.push({
        key, name, image: swatch?.image_url || null, fabricId: swatch?.fabric_id || null,
        variantLabel: [sizePart, name].filter(Boolean).join(" · "),
        unitCents: (row.price_cents ?? 0) > 0 ? row.price_cents! : null,
        currency: (row.price_cents ?? 0) > 0 ? currency : null,
      });
    }
  }
  const picked = [...parts.filter((x) => !isDim(x)), item.wood_fabric?.name].filter(Boolean).map((x) => fkey(String(x)));
  const designerKey = choices.find((c) => picked.includes(c.key))?.key
    ?? choices.find((c) => picked.some((p) => p.split("-").every((t) => c.key.includes(t)) || c.key.split("-").every((t) => p.includes(t))))?.key
    ?? null;
  const label = finishAxis === "top" ? item.product?.top_axis_label || null : item.product?.base_axis_label || null;
  return { choices, designerKey, label };
}

/**
 * Build the client-facing snapshot. Retail pricing only (clientSafe=true) —
 * net/trade prices, markups and internal notes are never included.
 */
export function buildSharedQuoteSnapshot(quoteId: string, clientName: string | null, items: ShareSourceLine[], swatchesByPick: Record<string, QuoteFinishSwatch[]> = {}): SharedQuoteSnapshot {
  const lines: SharedQuoteLine[] = items.map((item) => {
    const fc = buildFinishChoices(item, swatchesByPick[item.product?.source_pick_id || ""] ?? []);
    const pricing = quoteLinePricing(item, true);
    const dimensions = dimensionsFromVariantLabel(item.variant_label, item.product?.dimensions ?? null);
    // Selected finish = the recorded choices, never the size segment.
    const labelFinishes = (item.variant_label || "").split(" · ").map((s) => s.trim())
      .filter((s) => s && !dimensionsFromVariantLabel(s, null));
    const finishNames = [...new Set([...labelFinishes, item.wood_fabric?.name, item.fabric?.name]
      .filter((v): v is string => !!v && !!v.trim()).map((v) => v.trim()))];
    const finish = finishNames.join(" · ") || null;
    const designerChoice = fc.choices.find((c) => c.key === fc.designerKey);
    const recorded = [item.wood_fabric, item.fabric]
      .filter((f): f is { name?: string | null; image_url?: string | null } => !!f?.name)
      .map((f) => ({ name: String(f.name).trim(), image: f.image_url || null }));
    const finishSwatches = recorded.length ? recorded : designerChoice ? [{ name: designerChoice.name, image: designerChoice.image }] : [];
    return {
      name: item.product?.product_name || "Piece",
      maker: item.product?.brand_name || null,
      image: item.image_url || item.product?.image_url || null,
      finish,
      dimensions,
      // The catalogue's full material/finish range is only shown when the
      // client hasn't been given a specific selection.
      materials: item.product?.materials?.trim() || null,
      itemId: fc.choices.length ? item.id ?? null : null,
      finishLabel: fc.label,
      finishChoices: fc.choices,
      designerFinishKey: fc.designerKey,
      selectedFinishKey: fc.designerKey,
      finishOptions: finish || fc.choices.length ? [] : [...new Set((item.product?.available_finishes ?? []).map((value) => value.trim()).filter(Boolean))],
      finishSwatches,
      quantity: Math.max(0, Number(item.quantity) || 0),
      // Bundled price rows ("A / B / C") are saved as the single clicked name,
      // so fall back to that finish's own retail when catalogue lookup can't match.
      unitCents: pricing?.unitCents ?? designerChoice?.unitCents ?? null,
      lineTotalCents: pricing?.lineTotalCents ?? (designerChoice?.unitCents != null ? designerChoice.unitCents * Math.max(0, Number(item.quantity) || 0) : null),
      currency: pricing?.currency ?? designerChoice?.currency ?? null,
    };
  });
  const summary = summarizeQuoteLines(items, true);
  return {
    version: 1,
    quoteRef: `QU-${quoteId.slice(0, 6).toUpperCase()}`,
    clientName,
    lines,
    totals: summary.totals.map(({ currency, cents }) => ({ currency, cents })),
    lineCount: summary.lineCount,
    totalUnits: summary.totalUnits,
    unpricedCount: summary.unpricedCount,
  };
}
