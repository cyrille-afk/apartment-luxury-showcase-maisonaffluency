import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CuratorPick } from "@/components/FeaturedDesigners";
import { applyCuratorPickOrder, sortCuratorPicks } from "@/lib/curatorPickSort";

export interface DbProductItem {
  pick: CuratorPick;
  designerName: string;
  designerId: string;
  section: "designers" | "collectibles" | "ateliers";
}

/**
 * Fetches all curator picks from the database and converts them
 * to ProductItem format compatible with ProductGrid filtering.
 */
export function useDbCuratorPicks() {
  return useQuery({
    queryKey: ["db-curator-picks-for-grid"],
    queryFn: async (): Promise<DbProductItem[]> => {
      // Fetch published designers
      const { data: designers } = await supabase
        .from("designers")
        .select("id, name, slug, display_name, source")
        .eq("is_published", true);

      if (!designers?.length) return [];

      // Fetch all picks via public view
      const { data: picksRaw } = await applyCuratorPickOrder(
        supabase
          .from("designer_curator_picks_public" as any)
          .select("id, title, subtitle, image_url, hover_image_url, materials, dimensions, description, category, subcategory, tags, photo_credit, edition, pdf_url, pdf_filename, pdf_urls, designer_id, sort_order, created_at, size_variants, variant_placeholder, base_axis_label, top_axis_label, gallery_images, variant_image_map")
      );

      // Defensive client-side sort using identical rules (in case the view drops ORDER BY through joins).
      const picks = picksRaw ? sortCuratorPicks(picksRaw as any[]) : [];

      if (!picks.length) return [];

      // Build designer lookup
      const designerMap = new Map(
        designers.map((d) => [d.id, d])
      );

      const items: DbProductItem[] = [];

      for (const row of picks as any[]) {
        const designer = designerMap.get(row.designer_id);
        if (!designer) continue;

        const pick: CuratorPick = {
          image: row.image_url || undefined,
          hoverImage: row.hover_image_url || undefined,
          title: row.title || "",
          subtitle: row.subtitle || undefined,
          category: row.category || undefined,
          subcategory: row.subcategory || undefined,
          tags: row.tags || undefined,
          materials: row.materials || undefined,
          dimensions: row.dimensions || undefined,
          description: row.description || undefined,
          photoCredit: row.photo_credit || undefined,
          edition: row.edition || undefined,
          pdfUrl: row.pdf_url || undefined,
          pdfFilename: row.pdf_filename || undefined,
          pdfUrls: row.pdf_urls || undefined,
          size_variants: row.size_variants || undefined,
          variant_placeholder: row.variant_placeholder || undefined,
          base_axis_label: row.base_axis_label || undefined,
          top_axis_label: row.top_axis_label || undefined,
          gallery_images: row.gallery_images || undefined,
          variant_image_map: row.variant_image_map || undefined,
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
        });
      }

      return items;
    },
    staleTime: 10 * 60_000, // Cache for 10 minutes
    gcTime: 30 * 60_000,
  });
}
