/**
 * Legacy one-letter product slugs → canonical full slugs, scoped by designer
 * (two designers can share the same truncated letter, e.g. "y" for both
 * Yoyo Pendant and Yucca Console Travertin).
 *
 * These slugs were stored truncated by a slug-generation bug and fixed in the
 * database on 2026-10-12; this map keeps old shared/bookmarked URLs resolving
 * by redirecting them to the canonical address.
 */
export const LEGACY_PRODUCT_SLUGS: Record<string, Record<string, string>> = {
  "damien-langlois-meurinne": {
    g: "gleam-suspension",
    a: "another-day-table-lamp",
    l: "last-night-totem-floor-lamp",
  },
  "cristian-mohaded-cc-tapis": {
    f: "fuga-scene-2",
    "f-2": "fuga-scene-3",
  },
  "humbert-poyet": {
    y: "yoyo-pendant",
    p: "pendule-coffee-table",
  },
  "emma-donnersberg": {
    y: "yucca-console-travertin",
  },
  // Truncated slugs fixed 2026-10-16.
  "gilles-boissier": {
    "a-2": "albus-dining-chair", "a-3": "alda-table-lamp", "t-3": "amarre", a: "atlas-gueridon-table",
    "c-3": "caliope-sofa", c: "cere-coffee-table", "c-2": "circe-armchair", "d-2": "delphes",
    d: "demeter-coffee-table", "d-3": "diane-banquette", e: "egee-dining-table", p: "grand-plume",
    h: "helene-lamp", "untitled-piecei": "isis-armchair", i: "isos-room-divider", "i-2": "ithaque-dining-table",
    j: "jumeaux", l: "lascaux-table-lamp", "untitled-piec-2": "morphee-bed", "untitled-piec": "muse-guedridon-table",
    "p-2": "paro-bench", "s-3": "selene-table-lamp", "s-2": "seurat-table-lamp", s: "songe-pendant-light",
    t: "thetis-coffee-table", "t-2": "titan-sideboard", "t-4": "totem-floor-lamp",
  },
  "oa-london": {
    a: "avena-wall-light",
    h: "horas-dining-table",
  },
};

/** Canonical slug for a legacy (designer, product) slug pair, if any. */
export function resolveLegacyProductSlug(
  designerSlug: string | undefined,
  productSlug: string | undefined
): string | null {
  if (!designerSlug || !productSlug) return null;
  return LEGACY_PRODUCT_SLUGS[designerSlug]?.[productSlug] ?? null;
}
