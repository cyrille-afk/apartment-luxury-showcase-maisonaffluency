import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FinishPart } from "./visualiserFinishTargets";

/** Role saved on the 3D model admin page (shared with Product3DViewer). */
export type SavedMaterialRole = "fabric" | "backrest" | "base" | "top" | "ignore";
/** Per-GLB-material role for the visualiser; null = never refinished. */
export type VisualiserSavedRoles = Record<string, "upholstery" | "backrest" | "frame" | "top" | null>;

/** Translate saved roles into visualiser parts: fabric→upholstery, base→frame/base, ignore→untouched. */
export function toVisualiserRoles(saved: Record<string, SavedMaterialRole> | null | undefined): VisualiserSavedRoles {
  const out: VisualiserSavedRoles = {};
  for (const [name, role] of Object.entries(saved ?? {})) out[name] = role === "fabric" ? "upholstery" : role === "backrest" ? "backrest" : role === "base" ? "frame" : role === "top" ? "top" : null;
  return out;
}

/** Resolve the part a GLB material plays: saved mapping wins, then product schema, then name guessing. */
export function savedRolePart(saved: VisualiserSavedRoles | undefined, materialName: string, guessed: FinishPart | null): FinishPart | null | undefined {
  if (!saved || !Object.prototype.hasOwnProperty.call(saved, materialName)) return undefined;
  const role = saved[materialName];
  if (role === "frame") return guessed === "base" ? "base" : "frame";
  return role ?? null;
}

export function useSavedMaterialRoles(glbUrl: string | null | undefined) {
  return useQuery({
    queryKey: ["visualiser-saved-material-roles", glbUrl],
    enabled: !!glbUrl,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Security-definer read so client share links (guests) get the same mapping as collaborators.
      const { data, error } = await supabase.rpc("get_glb_material_roles", { _glb_url: glbUrl! });
      if (error) throw error;
      return toVisualiserRoles(data as Record<string, SavedMaterialRole> | null);
    },
  });
}
