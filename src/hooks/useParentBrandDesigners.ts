/**
 * Fetches sub-designers for parent brands from the database.
 * A parent brand is a designer where founder === name.
 * Sub-designers are designers whose founder matches the parent brand name.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const HIDDEN_CHILD_DESIGNER_SLUGS = new Set(["gabriel-hendifar"]);

export interface SubDesigner {
  name: string;
  slug: string;
  image: string;
  instagramUrl?: string;
}

export function useParentBrandDesigners(parentName: string | null) {
  return useQuery({
    queryKey: ["parent-brand-designers", parentName],
    enabled: !!parentName,
    staleTime: 1000 * 60 * 30, // 30 min
    queryFn: async () => {
      if (!parentName) return [];
      const { data, error } = await supabase
        .from("designers")
        .select("name, slug, image_url, links")
        .eq("founder", parentName)
        .neq("name", parentName)
        .eq("is_published", true)
        .order("name");
      if (error) throw error;
      return (data || []).filter((d) => !HIDDEN_CHILD_DESIGNER_SLUGS.has(d.slug)).map((d) => {
        const linksArr = Array.isArray(d.links) ? d.links : [];
        const igLink = linksArr.find((l: any) => l.type?.toLowerCase() === "instagram");
        return {
          name: d.name,
          slug: d.slug,
          image: d.image_url
            ? d.image_url.includes("cloudinary")
              ? d.image_url.replace(/w_\d+/, "w_200").replace(/h_\d+/, "h_267")
              : `https://res.cloudinary.com/dif1oamtj/image/fetch/w_200,h_267,c_fill,g_auto,q_auto,f_auto/${encodeURIComponent(d.image_url)}`
            : "",
          instagramUrl: (igLink as any)?.url || undefined,
        };
      }) as SubDesigner[];
    },
  });
}
