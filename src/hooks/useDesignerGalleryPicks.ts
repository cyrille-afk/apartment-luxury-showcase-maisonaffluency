import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAttributedDesignerPicks, useDesignerPicks, useGroupedDesignerPicks, type Designer, type DesignerCuratorPick } from "@/hooks/useDesigner";
import { isParentBrandDesigner } from "@/lib/designerHierarchy";
import { interleaveBySubcategory, sortCuratorPicks } from "@/lib/curatorPickSort";

/** One saved sequence and one set of cover images for public and trade designer galleries. */
export function useDesignerGalleryPicks(designer: Designer | null | undefined) {
  const isParentBrand = isParentBrandDesigner(designer);
  const isArnoldMadsen = designer?.slug === "arnold-madsen";
  const { data: groupedPicks = [] } = useGroupedDesignerPicks(isParentBrand ? designer : undefined, { publicOnly: true });
  const { data: ownPicks = [] } = useDesignerPicks(designer?.id, { publicOnly: true });
  const { data: attributedPicks = [] } = useAttributedDesignerPicks(designer && !isParentBrand ? designer : undefined, { publicOnly: true });
  const { data: dagmarAllPicks = [] } = useQuery({
    queryKey: ["arnold-madsen-dagmar-all-picks"],
    enabled: isArnoldMadsen,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: dagmar } = await supabase.from("designers").select("id").eq("slug", "dagmar-london").maybeSingle();
      if (!dagmar?.id) return [];
      const { data } = await supabase.from("designer_curator_picks_public").select("*").eq("designer_id", dagmar.id);
      return (data || []) as DesignerCuratorPick[];
    },
  });

  const picks = useMemo(() => {
    const rawPicks = isParentBrand && groupedPicks.length > 0
      ? groupedPicks
      : isArnoldMadsen
        ? dagmarAllPicks.filter((pick) => /^clam (chair|stool)(?:,|\s|$)/i.test(pick.title || ""))
        : [...ownPicks, ...attributedPicks];

    const bioUrls = new Set<string>();
    for (const entry of designer?.biography_images || []) {
      const url = entry?.split(/\s*\|\s*/)[0]?.trim();
      if (url) bioUrls.add(url);
    }
    for (const block of (designer?.biography || "").split(/\n\n+/)) {
      const url = block.trim().split(/\s*\|\s*/)[0]?.trim();
      if (url && /^https?:\/\//i.test(url) && !/\s/.test(url)) bioUrls.add(url);
    }
    const filtered = bioUrls.size > 0 && !isParentBrand && !isArnoldMadsen
      ? rawPicks.filter((pick) => !bioUrls.has(pick.image_url))
      : rawPicks;
    return interleaveBySubcategory(sortCuratorPicks(filtered));
  }, [designer, groupedPicks, ownPicks, attributedPicks, dagmarAllPicks, isParentBrand, isArnoldMadsen]);

  return { picks, dagmarAllPicks };
}