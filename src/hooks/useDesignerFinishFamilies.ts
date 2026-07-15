import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Loads the mapping of designer_id / pick_id → set of material families
 * (metal, wood, fabric, glass, stone, leather, composite, ceramic, other)
 * used across curator picks. Powers the "Finishes" facet.
 *
 * Only rows with role='primary' are used for filtering and counts so that
 * substrate/secondary materials (e.g. a hidden multilayer wood shell) don't
 * make a chair show up under "Wood". Non-primary rows are exposed via
 * `byPickSecondary` for "also contains" displays.
 */
export interface DesignerFinishMap {
  byDesigner: Map<string, Set<string>>;
  byPick: Map<string, Set<string>>;          // primary only — used for filtering
  byPickSecondary: Map<string, Set<string>>; // non-primary — for "also contains"
  counts: Map<string, number>;               // family → distinct designer count (primary)
}

async function fetchDesignerFinishFamilies(): Promise<DesignerFinishMap> {
  const { data, error } = await supabase
    .from("product_material_links")
    .select("pick_id, role, material_taxonomy:material_id(family, is_active), designer_curator_picks:pick_id(designer_id)")
    .not("pick_id", "is", null);

  if (error) throw error;

  const byDesigner = new Map<string, Set<string>>();
  const byPick = new Map<string, Set<string>>();
  const byPickSecondary = new Map<string, Set<string>>();
  for (const row of (data || []) as any[]) {
    const family: string | null = row?.material_taxonomy?.family ?? null;
    const active: boolean = row?.material_taxonomy?.is_active ?? false;
    const designerId: string | null = row?.designer_curator_picks?.designer_id ?? null;
    const pickId: string | null = row?.pick_id ?? null;
    const role: string = row?.role ?? "primary";
    if (!family || !active) continue;

    if (role === "primary") {
      if (designerId) {
        if (!byDesigner.has(designerId)) byDesigner.set(designerId, new Set());
        byDesigner.get(designerId)!.add(family);
      }
      if (pickId) {
        if (!byPick.has(pickId)) byPick.set(pickId, new Set());
        byPick.get(pickId)!.add(family);
      }
    } else if (pickId) {
      if (!byPickSecondary.has(pickId)) byPickSecondary.set(pickId, new Set());
      byPickSecondary.get(pickId)!.add(family);
    }
  }

  const counts = new Map<string, number>();
  for (const families of byDesigner.values()) {
    families.forEach((f) => counts.set(f, (counts.get(f) || 0) + 1));
  }

  return { byDesigner, byPick, byPickSecondary, counts };
}

export function useDesignerFinishFamilies() {
  return useQuery({
    queryKey: ["designer-finish-families"],
    queryFn: fetchDesignerFinishFamilies,
    staleTime: 5 * 60 * 1000,
  });
}
