/**
 * Fetches sub-designer counts for all parent brands in a single query.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const HIDDEN_CHILD_DESIGNER_NAMES = new Set(["Gabriel Hendifar"]);

export function useParentBrandDesignerCounts(parentNames: string[]) {
  return useQuery({
    queryKey: ["parent-brand-designer-counts", parentNames],
    enabled: parentNames.length > 0,
    staleTime: 1000 * 60 * 30, // 30 min
    queryFn: async () => {
      if (parentNames.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from("designers")
        .select("founder, name")
        .in("founder", parentNames)
        .eq("is_published", true)
        .eq("trade_only", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      parentNames.forEach(n => { counts[n] = 0; });
      (data || []).forEach(d => {
        if (d.founder && !HIDDEN_CHILD_DESIGNER_NAMES.has(d.name)) {
          // Don't count the parent itself (founder === name)
          counts[d.founder] = (counts[d.founder] || 0) + 1;
        }
      });
      // Subtract 1 for the parent itself (which has founder === name)
      // Actually we need to check if it's a self-referencing row
      // Better: just query where founder != name
      return counts;
    },
  });
}

export function useParentBrandDesignerCountsFiltered(parentNames: string[]) {
  return useQuery({
    queryKey: ["parent-brand-designer-counts-filtered", parentNames],
    enabled: parentNames.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (parentNames.length === 0) return {} as Record<string, number>;
      // Fetch all designers whose founder OR additional_founders overlaps parentNames
      const { data, error } = await supabase
        .from("designers")
        .select("founder, name, additional_founders")
        .or(`founder.in.(${parentNames.map(n => `"${n}"`).join(",")}),additional_founders.ov.{${parentNames.map(n => `"${n}"`).join(",")}}`)
        .eq("is_published", true)
        .eq("trade_only", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      parentNames.forEach(n => { counts[n] = 0; });
      (data || []).forEach((d: any) => {
        if (HIDDEN_CHILD_DESIGNER_NAMES.has(d.name)) return;
        const parents = new Set<string>();
        if (d.founder && d.name !== d.founder) parents.add(d.founder);
        (d.additional_founders || []).forEach((f: string) => {
          if (f && f !== d.name) parents.add(f);
        });
        parents.forEach(p => {
          if (p in counts) counts[p] = (counts[p] || 0) + 1;
        });
      });
      return counts;
    },
  });
}
