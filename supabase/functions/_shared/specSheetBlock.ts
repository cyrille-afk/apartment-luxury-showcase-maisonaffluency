// Auto-compiled spec-sheet block for multi-piece recommendations.
// Renders a plain-text table-ish list: title, designer, dims, materials,
// lead time, SKU/id — one row per piece. Also emits a structured payload
// suitable for embedding in tool args (constraint UIs, PDF renderers, tests).

export type SpecSheetPiece = {
  id: string;
  title?: string | null;
  designer_name?: string | null;
  brand_name?: string | null;
  dimensions?: string | null;
  materials?: string | null;
  lead_time?: string | null;
  stock_status?: string | null;
  category?: string | null;
  price_cents?: number | null;
  currency?: string | null;
};

export type SpecSheetRow = {
  id: string;
  sku: string;
  title: string;
  designer: string;
  dimensions: string;
  materials: string;
  lead_time: string;
};

const DASH = "—";

function clean(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : DASH;
}

/**
 * Append an imperial conversion to a metric dimensions string, matching the
 * site-wide convention used by <ProductPage />:
 *   "W 82 × D 77 × H 73 cm — SH 41 cm"
 *   → "W 82 × D 77 × H 73 cm — SH 41 cm | W 32.3 × D 30.3 × H 28.7 — SH 16.1 in"
 *
 * Rules:
 *   • Only runs when the string carries at least one "cm" token.
 *   • Skips conversion if the string already contains an inch marker (", ″, in).
 *   • Preserves labels (W/D/H/SH/Ø…) and separators (×, x, —, /, ,).
 *   • Uses one decimal place, mirroring formatDimensions.ts.
 */
export function appendInchesToDimensions(input: string | null | undefined): string {
  const s = typeof input === "string" ? input.trim() : "";
  if (!s || s === DASH) return DASH;
  if (/["″]|\bin\b/i.test(s)) return s;
  if (!/\bcm\b/i.test(s)) return s;

  const imperial = s
    // Drop every "cm" token — the trailing " in" will label the whole clause.
    .replace(/\s*\bcm\b/gi, "")
    // Convert every numeric literal (including decimals with . or ,) to inches.
    .replace(/(\d+(?:[.,]\d+)?)/g, (_m, num: string) => {
      const cm = parseFloat(num.replace(",", "."));
      if (!Number.isFinite(cm)) return num;
      return (cm / 2.54).toFixed(1);
    })
    .replace(/\s+/g, " ")
    .trim();

  if (!imperial) return s;
  return `${s} | ${imperial} in`;
}

/** Short 8-char SKU derived from the pick UUID — stable and copy-pasteable. */
export function shortSku(id: string): string {
  const compact = String(id || "").replace(/-/g, "");
  return compact ? `MA-${compact.slice(0, 8).toUpperCase()}` : DASH;
}

export function buildSpecSheetRows(pieces: SpecSheetPiece[]): SpecSheetRow[] {
  return pieces
    .filter((p) => p && typeof p.id === "string" && p.id.length > 0)
    .map((p) => ({
      id: p.id,
      sku: shortSku(p.id),
      title: clean(p.title),
      designer: clean(p.designer_name || p.brand_name),
      dimensions: appendInchesToDimensions(p.dimensions),
      materials: clean(p.materials),
      lead_time: clean(p.lead_time || p.stock_status),
    }));
}

/**
 * Render a Markdown-safe plain-text block that lists each piece with its
 * spec fields. Kept intentionally compact so it fits inside a proposal note
 * without dominating the chat surface.
 */
export function renderSpecSheetBlock(pieces: SpecSheetPiece[]): string {
  const rows = buildSpecSheetRows(pieces);
  if (rows.length < 2) return "";
  const lines: string[] = ["Spec sheet:"];
  for (const r of rows) {
    lines.push(`• ${r.title} — ${r.designer} [${r.sku}]`);
    lines.push(`   Dimensions: ${r.dimensions}`);
    lines.push(`   Materials: ${r.materials}`);
    lines.push(`   Lead time: ${r.lead_time}`);
  }
  return lines.join("\n");
}
