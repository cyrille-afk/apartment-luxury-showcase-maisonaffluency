import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveCuratorPickDescription } from "@/lib/curatorPickDescription";

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
  hero_image_url: string | null;
  hero_photo_credit: string | null;
  logo_url: string | null;
  source: string;
  links: { type: string; url?: string }[];
  biography_images: string[];
  is_published: boolean;
  sort_order: number;
  new_in_order: number | null;
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
  trade_price_cents: number | null;
  currency: string;
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

/** Fetch a single designer by exact name */
export function useDesignerByName(name: string | undefined) {
  return useQuery({
    queryKey: ["designer-by-name", name],
    queryFn: async () => {
      if (!name) return null;
      const { data, error } = await supabase
        .from("designers")
        .select("*")
        .eq("name", name)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        links: (data.links as Designer["links"]) || [],
      } as Designer;
    },
    enabled: !!name,
  });
}

/** Fetch curator picks for a designer */
export function useDesignerPicks(designerId: string | undefined, { publicOnly = false }: { publicOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["designer-picks", designerId, publicOnly],
    queryFn: async () => {
      if (!designerId) return [];
      if (publicOnly) {
        const { data, error } = await supabase
          .from("designer_curator_picks_public")
          .select("*")
          .eq("designer_id", designerId)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        return (data || []).map((d) => ({
          ...d,
          description: resolveCuratorPickDescription({ description: d.description }),
          trade_price_cents: null,
          pdf_urls: d.pdf_urls as DesignerCuratorPick["pdf_urls"],
        })) as DesignerCuratorPick[];
      }
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("*")
        .eq("designer_id", designerId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []).map((d) => ({
        ...d,
        description: resolveCuratorPickDescription({ description: d.description }),
        pdf_urls: d.pdf_urls as DesignerCuratorPick["pdf_urls"],
      })) as DesignerCuratorPick[];
    },
    enabled: !!designerId,
  });
}

/** Pick with designer attribution */
export interface AttributedCuratorPick extends DesignerCuratorPick {
  designer_name: string;
  designer_slug: string;
}

/** Fetch curator picks for a parent brand and its sub-designers, with attribution */
export function useGroupedDesignerPicks(designer: Designer | null | undefined, { publicOnly = false }: { publicOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["designer-grouped-picks", designer?.id, designer?.name, publicOnly],
    queryFn: async () => {
      if (!designer) return [];
      const isParentBrand = !!designer.founder && [designer.name, designer.display_name].includes(designer.founder);
      if (!isParentBrand) return [];

      // Find sub-designers whose founder matches this parent designer's name or display_name
      const founderNames = [designer.name, designer.display_name].filter((n): n is string => !!n);
      const uniqueFounderNames = [...new Set(founderNames)];
      const { data: subDesigners, error: subDesignersError } = await supabase
        .from("designers")
        .select("id, name, slug")
        .in("founder", uniqueFounderNames)
        .neq("id", designer.id);
      if (subDesignersError) throw subDesignersError;

      const subOnly = (subDesigners || []).filter((d) => d.id !== designer.id);

      // Deduplicate: current parent + children
      const seen = new Set<string>();
      const allDesigners: { id: string; name: string; slug: string }[] = [];
      for (const d of [{ id: designer.id, name: designer.name, slug: designer.slug }, ...subOnly]) {
        if (!seen.has(d.id)) { seen.add(d.id); allDesigners.push(d); }
      }

      const designerIds = allDesigners.map((d) => d.id);
      const nameMap = Object.fromEntries(allDesigners.map((d) => [d.id, { name: d.name, slug: d.slug }]));

      if (publicOnly) {
        const { data, error } = await supabase
          .from("designer_curator_picks_public")
          .select("*")
          .in("designer_id", designerIds)
          .order("sort_order", { ascending: true });
        if (error) throw error;
        return (data || []).map((d) => ({
          ...d,
          description: resolveCuratorPickDescription({ description: d.description }),
          trade_price_cents: null,
          pdf_urls: d.pdf_urls as DesignerCuratorPick["pdf_urls"],
          designer_name: nameMap[d.designer_id]?.name || designer.name,
          designer_slug: nameMap[d.designer_id]?.slug || designer.slug,
        })) as AttributedCuratorPick[];
      }

      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("*")
        .in("designer_id", designerIds)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return (data || []).map((d) => ({
        ...d,
        description: resolveCuratorPickDescription({ description: d.description }),
        pdf_urls: d.pdf_urls as DesignerCuratorPick["pdf_urls"],
        designer_name: nameMap[d.designer_id]?.name || designer.name,
        designer_slug: nameMap[d.designer_id]?.slug || designer.slug,
      })) as AttributedCuratorPick[];
    },
    enabled: !!designer,
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

/** Fetch designers marked as "New In", ordered by new_in_order */
export function useNewInDesigners() {
  return useQuery({
    queryKey: ["designers-new-in"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("*")
        .not("new_in_order", "is", null)
        .order("new_in_order", { ascending: true });
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
