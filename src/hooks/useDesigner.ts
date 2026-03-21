import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Designer {
  id: string;
  slug: string;
  name: string;
  founder: string | null;
  display_name: string | null;
  specialty: string;
  biography: string;
  notable_works: string;
  philosophy: string;
  image_url: string;
  logo_url: string | null;
  source: string;
  links: { type: string; url?: string }[];
  is_published: boolean;
  sort_order: number;
}

export interface DesignerCuratorPick {
  id: string;
  designer_id: string;
  image_url: string;
  hover_image_url: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  materials: string | null;
  dimensions: string | null;
  description: string | null;
  edition: string | null;
  photo_credit: string | null;
  pdf_url: string | null;
  pdf_filename: string | null;
  pdf_urls: { label: string; url: string; filename?: string }[] | null;
  sort_order: number;
}

/** Fetch a single designer by slug */
export function useDesigner(slug: string | undefined) {
  return useQuery({
    queryKey: ["designer", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("designers")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        links: (data.links as Designer["links"]) || [],
      } as Designer;
    },
    enabled: !!slug,
  });
}

/** Fetch curator picks for a designer */
export function useDesignerPicks(designerId: string | undefined) {
  return useQuery({
    queryKey: ["designer-picks", designerId],
    queryFn: async () => {
      if (!designerId) return [];
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("*")
        .eq("designer_id", designerId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((d) => ({
        ...d,
        pdf_urls: d.pdf_urls as DesignerCuratorPick["pdf_urls"],
      })) as DesignerCuratorPick[];
    },
    enabled: !!designerId,
  });
}

/** Fetch all designers (for directory) */
export function useAllDesigners() {
  return useQuery({
    queryKey: ["designers-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((d) => ({
        ...d,
        links: (d.links as Designer["links"]) || [],
      })) as Designer[];
    },
  });
}

/** Fetch related designers (same source or specialty keywords) */
export function useRelatedDesigners(
  currentSlug: string | undefined,
  source: string | undefined,
  count = 3
) {
  return useQuery({
    queryKey: ["designers-related", currentSlug, source],
    queryFn: async () => {
      if (!currentSlug) return [];
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, name, specialty, image_url, source")
        .neq("slug", currentSlug)
        .limit(20);
      if (error) throw error;
      if (!data) return [];

      // Score by source match, then random
      const scored = data.map((d) => ({
        ...d,
        score: d.source === source ? 2 : 0,
      }));
      scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);
      return scored.slice(0, count) as (Designer & { score: number })[];
    },
    enabled: !!currentSlug,
  });
}
