/**
 * Fills missing trade_products.image_url from the source curator pick.
 * Used by Client Board viewer, Tearsheet builder, FF&E renderers — anywhere
 * that displays a trade product hero image and would otherwise show a blank
 * card when the mirror row was created without an image.
 *
 * Strategy: look up the linked designer_curator_picks row via source_pick_id
 * (preferred) — falls back to brand+name match for legacy rows that pre-date
 * the source_pick_id backfill.
 */
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  product_name?: string | null;
  brand_name?: string | null;
  image_url?: string | null;
  [k: string]: any;
};

function pickFirstImage(pick: any): string | null {
  if (pick?.image_url) return pick.image_url as string;
  const gallery = pick?.gallery_images;
  if (Array.isArray(gallery)) {
    const first = gallery.find((g: any) => typeof g === "string" && g)
      ?? gallery.find((g: any) => g && typeof g === "object" && g.url)?.url;
    if (typeof first === "string" && first) return first;
  }
  return null;
}

/**
 * Mutates each row in place: when image_url is missing/empty, set it from the
 * matching curator pick. Returns the same array for chaining.
 */
export async function fillTradeProductImageFallbacks<T extends Row>(rows: T[]): Promise<T[]> {
  if (!rows?.length) return rows;
  const needs = rows.filter((r) => !r.image_url);
  if (!needs.length) return rows;

  const ids = needs.map((r) => r.id).filter(Boolean);
  if (!ids.length) return rows;

  // 1. Pull source_pick_id linkage for the mirror rows we need to backfill.
  const { data: links } = await supabase
    .from("trade_products")
    .select("id, source_pick_id, product_name, brand_name")
    .in("id", ids);

  const pickIds = (links || [])
    .map((l: any) => l.source_pick_id)
    .filter(Boolean) as string[];

  const pickById = new Map<string, any>();
  if (pickIds.length) {
    const { data: picks } = await supabase
      .from("designer_curator_picks")
      .select("id, image_url, gallery_images, title")
      .in("id", pickIds);
    (picks || []).forEach((p: any) => pickById.set(p.id, p));
  }

  // 2. Legacy fallback: anything still unresolved, match by exact title.
  const unresolvedTitles = (links || [])
    .filter((l: any) => !l.source_pick_id && l.product_name)
    .map((l: any) => l.product_name as string);

  const pickByTitle = new Map<string, any>();
  if (unresolvedTitles.length) {
    const { data: legacy } = await supabase
      .from("designer_curator_picks")
      .select("title, image_url, gallery_images")
      .in("title", unresolvedTitles)
      .not("image_url", "is", null);
    (legacy || []).forEach((p: any) => {
      if (!pickByTitle.has(p.title)) pickByTitle.set(p.title, p);
    });
  }

  const linkById = new Map<string, any>((links || []).map((l: any) => [l.id, l]));

  for (const row of needs) {
    const link = linkById.get(row.id);
    if (!link) continue;
    const pick = (link.source_pick_id && pickById.get(link.source_pick_id))
      || (link.product_name && pickByTitle.get(link.product_name))
      || null;
    const url = pickFirstImage(pick);
    if (url) row.image_url = url;
  }

  return rows;
}
