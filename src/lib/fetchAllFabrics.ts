import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000;

/**
 * Loads every fabrics row, paging past the backend's 1000-row response cap.
 * Without paging, rows sorting late (e.g. "Smooth Oak", "Walnut") silently vanish.
 */
export async function fetchAllFabrics<T = any>(
  columns = "*",
  opts: { activeOnly?: boolean } = {},
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from("fabrics").select(columns);
    if (opts.activeOnly) q = q.eq("is_active", true);
    const { data, error } = await q
      .order("category")
      .order("supplier")
      .order("sort_order")
      .order("name")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data as T[]) || [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
