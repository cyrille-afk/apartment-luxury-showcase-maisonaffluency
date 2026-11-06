// Count badges for the Shop by Room navigation mega-menu. Uses the exact same
// matching helpers as the room grid (src/lib/roomMatching.ts) so the numbers
// shown in the menu can never drift from what the room pages display.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCachedCatalog } from "@/lib/catalogSource";
import { filterPublicPicks } from "@/lib/publicCatalogVisibility";
import { fetchPublicDesignerCredits } from "@/lib/publicDesignerCredits";
import type { RoomSlug } from "@/lib/roomCategories";
import { pickMatchesRoom, pickMatchesFilter } from "@/lib/roomMatching";
import type { CuratorPick } from "@/components/FeaturedDesigners";

/** Load the browsable public catalogue pool (cached manifest for anonymous
 *  visitors, direct public view for signed-in users). */
async function loadCatalogPool(): Promise<CuratorPick[]> {
  const cached = await getCachedCatalog();
  if (cached?.picks?.length) {
    return filterPublicPicks(cached.picks, cached.designers) as unknown as CuratorPick[];
  }
  const [{ data, error }, designersRes] = await Promise.all([
    supabase
      .from("designer_curator_picks_public")
      .select("id, designer_id, title, subtitle, category, subcategory, tags, image_url")
      .not("image_url", "is", null),
    supabase.from("designers").select("id, is_published, trade_only"),
  ]);
  if (error) throw error;
  if (designersRes.error) throw designersRes.error;
  return filterPublicPicks((data ?? []) as any[], designersRes.data as any[]).map((row: any) => ({
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
  const query = useQuery({
    queryKey: ["navigation-catalog-pool"] as const,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: loadCatalogPool,
  });
  const data = useMemo(() => {
      if (!room || !query.data) return undefined;
      const pool = query.data;
      const inRoom = pool.filter((pick) => pickMatchesRoom(pick, room));
      const out: Record<string, number> = {};
      for (const { category } of categories) {
        out[category] = inRoom.filter((pick) => pickMatchesFilter(pick, category, null)).length;
      }
      return out;
  }, [query.data, room, categoryKey]);
  return { ...query, data };
}

/**
 * Catalogue-wide counts for the product-type mega-menu (Furniture, Lighting,
 * Mirrors…). Each entry matches via the same grid helper as category pages.
 */
export function useCategoryMenuCounts(entries: { key: string; category: string; subcategory?: string | null }[], options: { enabled?: boolean } = {}) {
  const signature = entries.map((e) => `${e.key}:${e.category}:${e.subcategory ?? ""}`).join("|");
  const enabled = options.enabled ?? true;
  const query = useQuery({
    queryKey: ["navigation-catalog-pool"] as const,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: loadCatalogPool,
    enabled,
  });
  const data = useMemo(() => {
      if (!enabled || !query.data) return undefined;
      const pool = query.data;
      const out: Record<string, number> = {};
      for (const e of entries) {
        out[e.key] = pool.filter((pick) => pickMatchesFilter(pick, e.category, e.subcategory ?? null)).length;
      }
      return out;
  }, [query.data, signature, enabled]);
  return { ...query, data };
}
