// Count badges for the Shop by Room navigation mega-menu. Uses the exact same
// matching helpers as the room grid (src/lib/roomMatching.ts) so the numbers
// shown in the menu can never drift from what the room pages display.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedCatalog } from "@/lib/catalogSource";
import type { RoomSlug } from "@/lib/roomCategories";
import { pickMatchesRoom, pickMatchesFilter } from "@/lib/roomMatching";
import type { CuratorPick } from "@/components/FeaturedDesigners";

/** Load the browsable public catalogue pool (cached manifest for anonymous
 *  visitors, direct public view for signed-in users). */
async function loadCatalogPool(): Promise<CuratorPick[]> {
  const cached = await getCachedCatalog();
  if (cached?.picks?.length) return cached.picks as unknown as CuratorPick[];
  const { data, error } = await supabase
    .from("designer_curator_picks_public")
    .select("id, title, subtitle, category, subcategory, tags, image_url")
    .not("image_url", "is", null);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    subcategory: row.subcategory,
    tags: row.tags ?? [],
    image: row.image_url,
  })) as unknown as CuratorPick[];
}

/**
 * Counts, for one room, how many catalogue pieces live in each of the menu's
 * top-level category buckets (Seating, Tables, Storage, …). Keyed by the
 * category name exactly as the menu labels it.
 */
export function useRoomMenuCounts(room: RoomSlug | null, categories: { category: string }[]) {
  const categoryKey = categories.map((c) => c.category).join("|");
  return useQuery({
    queryKey: ["room-menu-counts", room, categoryKey] as const,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    enabled: Boolean(room) && categories.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      if (!room) return {};
      const pool = await loadCatalogPool();
      const inRoom = pool.filter((pick) => pickMatchesRoom(pick, room));
      const out: Record<string, number> = {};
      for (const { category } of categories) {
        out[category] = inRoom.filter((pick) => pickMatchesFilter(pick, category, null)).length;
      }
      return out;
    },
  });
}
