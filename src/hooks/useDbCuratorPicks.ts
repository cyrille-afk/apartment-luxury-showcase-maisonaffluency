import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CuratorPick } from "@/components/FeaturedDesigners";
import { applyCuratorPickOrder, sortCuratorPicks } from "@/lib/curatorPickSort";
import { queryKeys } from "@/lib/queryKeys";
import { getCachedCatalog } from "@/lib/catalogSource";

export interface DbProductItem {
  pick: CuratorPick;
  designerName: string;
  designerId: string;
  section: "designers" | "collectibles" | "ateliers";
  reeditionBy?: string;
  /** Published designer credited in the pick subtitle (e.g. Dagmar's Clam pieces → Arnold Madsen). */
  attributedDesigner?: string;
}

/**
 * Fetches all curator picks from the database and converts them
 * to ProductItem format compatible with ProductGrid filtering.
 */
export function useDbCuratorPicks(options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryKey: queryKeys.curatorPicksGrid(),
    queryFn: async (): Promise<DbProductItem[]> => {
      // Anonymous visitors read the CDN-cached catalogue manifest; signed-in
      // trade users fall through to the live, permission-scoped queries.
      const cachedCatalog = await getCachedCatalog();

      let designers: Array<{ id: string; name: string; slug: string; display_name: string | null; source: string | null; founder: string | null }>;
      let picksRaw: any[] | null;

      if (cachedCatalog) {
        designers = cachedCatalog.designers.filter(
          (designer) => designer.is_published && !designer.trade_only,
        ) as any[];
        picksRaw = cachedCatalog.picks as any[];
      } else {
        // Public browsing grids must contain only published, non-trade-only designers.
        const { data: designerRows } = await supabase
          .from("designers")
          .select("id, name, slug, display_name, source, founder")
          .eq("is_published", true)
          .eq("trade_only", false);
        designers = (designerRows || []) as any[];

        // Fetch all picks via public view
        const { data } = await applyCuratorPickOrder(
          supabase
            .from("designer_curator_picks_public" as any)
            // Slim listing fetch: no description / gallery_images / size_variants /
            // variant_* — those are lazily fetched on card open (lightbox / product page).
            .select("id, slug, title, subtitle, image_url, hover_image_url, materials, dimensions, lead_time, origin, category, subcategory, tags, photo_credit, edition, pdf_url, pdf_filename, pdf_urls, designer_id, sort_order, created_at")
        );
        picksRaw = data as any[] | null;
      }

      if (!designers?.length) return [];


      // Defensive client-side sort using identical rules (in case the view drops ORDER BY through joins).
      const picks = picksRaw ? sortCuratorPicks(picksRaw as any[]) : [];

      if (!picks.length) return [];

      // Build designer lookup
      const designerMap = new Map(
        designers.map((d) => [d.id, d])
      );

      const designerByName = new Map<string, string>();
      for (const d of designers) {
        const label = d.display_name || d.name;
        for (const n of [d.name, d.display_name]) if (n) designerByName.set(n.trim().toLowerCase(), label);
      }

      const items: DbProductItem[] = [];

      for (const row of picks as any[]) {
        const designer = designerMap.get(row.designer_id);
        if (!designer) continue;
        // Profile-only picks (e.g. per-wood Clam Chair splits on Arnold Madsen)
        // live on the designer page but must never enter the browsing grids.
        if ((row.tags || []).includes("profile-only")) continue;

        const pick: CuratorPick = {
          id: row.id,
          slug: row.slug || undefined,
          image: row.image_url || undefined,
          hoverImage: row.hover_image_url || undefined,
          title: row.title || "",
          subtitle: row.subtitle || undefined,
          category: row.category || undefined,
          subcategory: row.subcategory || undefined,
          tags: row.tags || undefined,
          materials: row.materials || undefined,
          lead_time: row.lead_time || undefined,
          origin: row.origin || undefined,
          dimensions: row.dimensions || undefined,
          photoCredit: row.photo_credit || undefined,
          edition: row.edition || undefined,
          pdfUrl: row.pdf_url || undefined,
          pdfFilename: row.pdf_filename || undefined,
          pdfUrls: row.pdf_urls || undefined,
          // description / gallery_images / size_variants / variant_* are intentionally
          // omitted from the listing payload — fetched via useCuratorPickDetail on open.
        };

        if (!pick.image) continue;

        // Determine section based on designer source
        const section: DbProductItem["section"] =
          designer.source === "collectible" ? "collectibles"
          : designer.source === "atelier" ? "ateliers"
          : "designers";

        items.push({
          pick,
          designerName: designer.display_name || designer.name,
          designerId: designer.slug || designer.id,
          section,
          reeditionBy: designer.founder || undefined,
          attributedDesigner: (() => {
            const credited = designerByName.get(String(row.subtitle || "").trim().toLowerCase());
            return credited && credited !== (designer.display_name || designer.name) ? credited : undefined;
          })(),
        });
      }

      // ────────────────────────────────────────────────────────────────
      // Dedupe parent/child duplicates.
      // When the SAME product (matched on normalized title) exists under
      // both a parent brand (e.g. "Marta Sala Éditions") AND one of its
      // child designers (e.g. "Lazzarini & Pickering", whose `founder`
      // equals the parent's `name`), keep only the parent's row so the
      // catalog doesn't show the same sofa twice.
      // ────────────────────────────────────────────────────────────────
      const normalizeTitle = (t: string) =>
        (t || "")
          .toLowerCase()
          // strip trailing " for X" / " by X" / " with X" attribution
          .replace(/\s+(for|by|with|x)\s+.+$/i, "")
          .replace(/[^\w\s]/g, " ")
          .trim()
          .replace(/\s+/g, " ");


      const groups = new Map<string, DbProductItem[]>();
      for (const it of items) {
        const key = normalizeTitle(it.pick.title);
        if (!key) continue;
        const arr = groups.get(key) || [];
        arr.push(it);
        groups.set(key, arr);
      }

      const dropped = new Set<DbProductItem>();
      for (const arr of groups.values()) {
        if (arr.length < 2) continue;
        for (const a of arr) {
          for (const b of arr) {
            if (a === b || dropped.has(a) || dropped.has(b)) continue;
            // Resolve via name lookup (designerName is display, may differ from .name)

            const aDesigner = designers.find((d: any) => d.slug === a.designerId || d.id === a.designerId);
            const bDesigner = designers.find((d: any) => d.slug === b.designerId || d.id === b.designerId);
            if (!aDesigner || !bDesigner) continue;
            const aFounder = (aDesigner.founder || "").trim();
            const bFounder = (bDesigner.founder || "").trim();
            // b is parent of a → drop a
            if (aFounder && aFounder.toLowerCase() === bDesigner.name.toLowerCase()) {
              dropped.add(a);
            } else if (bFounder && bFounder.toLowerCase() === aDesigner.name.toLowerCase()) {
              dropped.add(b);
            }
          }
        }
      }

      return items.filter((it) => !dropped.has(it));
    },
    staleTime: 10 * 60_000, // Cache for 10 minutes
    gcTime: 30 * 60_000,
  });
}

/**
 * Total published picks in the master catalogue (before profile-only splits
 * and parent/child dedupe). Anonymous visitors read the count from the cached
 * manifest; signed-in trade users use a cheap head-count query.
 */
export function useMasterCatalogCount() {
  return useQuery({
    queryKey: ["master-catalog-count"] as const,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<number> => {
      const cachedCatalog = await getCachedCatalog();
      if (cachedCatalog) return cachedCatalog.picks.length;
      const { count } = await supabase
        .from("designer_curator_picks_public" as any)
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
}

