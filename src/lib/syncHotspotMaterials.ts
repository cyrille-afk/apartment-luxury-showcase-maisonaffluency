import { supabase } from "@/integrations/supabase/client";
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import { atelierOnlyPicks } from "@/components/BrandsAteliers";

/**
 * Build a lookup: designerId -> CuratorPick[]
 * from all three data sources.
 */
function buildCuratorPicksMap(): Map<string, CuratorPick[]> {
  const map = new Map<string, CuratorPick[]>();

  // FeaturedDesigners
  for (const d of featuredDesigners) {
    if (d.id && d.curatorPicks) {
      map.set(d.id, d.curatorPicks);
    }
  }

  // Collectibles
  for (const d of collectibleDesigners) {
    if (d.id && d.curatorPicks) {
      map.set(d.id, d.curatorPicks);
    }
  }

  // Atelier-only picks
  for (const [id, data] of Object.entries(atelierOnlyPicks)) {
    if (data.curatorPicks) {
      map.set(id, data.curatorPicks);
    }
  }

  return map;
}

/**
 * Parse a link_url like "#curators/leo-sentou/3" into { designerId, index }
 */
function parseLinkUrl(url: string): { designerId: string; index: number } | null {
  // Normalize: remove leading # or #/
  const cleaned = url.replace(/^#\/?/, "");
  const match = cleaned.match(/^curators\/([^/]+)\/(\d+)$/);
  if (!match) return null;
  return { designerId: match[1], index: parseInt(match[2], 10) };
}

/**
 * Sync materials & dimensions from Curators' Picks into gallery_hotspots.
 * Returns a summary of updates made.
 */
export async function syncHotspotMaterials(): Promise<{
  updated: number;
  skipped: number;
  noMatch: string[];
}> {
  const picksMap = buildCuratorPicksMap();

  // Fetch all hotspots that have a link_url but no materials
  const { data: hotspots, error } = await supabase
    .from("gallery_hotspots")
    .select("id, product_name, link_url, materials, dimensions")
    .not("link_url", "is", null);

  if (error || !hotspots) {
    console.error("Failed to fetch hotspots:", error);
    return { updated: 0, skipped: 0, noMatch: [] };
  }

  let updated = 0;
  let skipped = 0;
  const noMatch: string[] = [];

  for (const hotspot of hotspots) {
    // Skip if already has materials and dimensions
    if (hotspot.materials && hotspot.dimensions) {
      skipped++;
      continue;
    }

    const parsed = parseLinkUrl(hotspot.link_url!);
    if (!parsed) {
      noMatch.push(`${hotspot.product_name} (invalid link: ${hotspot.link_url})`);
      continue;
    }

    const picks = picksMap.get(parsed.designerId);
    if (!picks || !picks[parsed.index]) {
      noMatch.push(`${hotspot.product_name} (designer: ${parsed.designerId}, index: ${parsed.index})`);
      continue;
    }

    const pick = picks[parsed.index];
    const updateData: Record<string, string> = {};

    if (!hotspot.materials && pick.materials) {
      updateData.materials = pick.materials;
    }
    if (!hotspot.dimensions && pick.dimensions) {
      updateData.dimensions = pick.dimensions;
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("gallery_hotspots")
        .update(updateData)
        .eq("id", hotspot.id);

      if (updateError) {
        console.error(`Failed to update ${hotspot.product_name}:`, updateError);
        noMatch.push(`${hotspot.product_name} (update failed)`);
      } else {
        updated++;
      }
    } else {
      skipped++;
    }
  }

  return { updated, skipped, noMatch };
}
