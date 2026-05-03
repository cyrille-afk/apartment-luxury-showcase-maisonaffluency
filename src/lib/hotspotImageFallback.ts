import { supabase } from "@/integrations/supabase/client";

const normName = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const normBrand = (s: string) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

/**
 * Mutates the given products in-place, filling `image_url` from
 * `gallery_hotspots` whenever it is missing. Used so rugs (and any other
 * product whose only photo lives on a hotspot) still render thumbnails on
 * tearsheets, search results, and concierge previews.
 *
 * Each item must expose `product_name` (or `title`) and optionally
 * `brand_name` (or `designer_name`) so we can disambiguate brand collisions.
 */
export async function fillHotspotImages(items: Array<Record<string, any>>): Promise<void> {
  const missing = items.filter((p) => !p.image_url);
  if (missing.length === 0) return;

  const { data: hotspots } = await supabase
    .from("gallery_hotspots")
    .select("product_name, designer_name, product_image_url")
    .not("product_image_url", "is", null);

  if (!hotspots || hotspots.length === 0) return;

  const byName = new Map<string, string>();
  const byBrandName = new Map<string, string>();
  for (const h of hotspots as any[]) {
    const n = normName(h.product_name);
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, h.product_image_url);
    const bKey = `${normBrand(h.designer_name)}|${n}`;
    if (!byBrandName.has(bKey)) byBrandName.set(bKey, h.product_image_url);
  }

  for (const p of missing) {
    const title = p.product_name ?? p.title ?? "";
    const brand = p.brand_name ?? p.designer_name ?? "";
    const n = normName(title);
    if (!n) continue;
    const hit =
      (brand && byBrandName.get(`${normBrand(brand)}|${n}`)) || byName.get(n) || null;
    if (hit) {
      p.image_url = hit;
      // Flag so the UI can render a small "from hotspot" indicator.
      p.image_from_hotspot = true;
    }
  }
}
