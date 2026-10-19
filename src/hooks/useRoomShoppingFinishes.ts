import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RoomFinishMap } from '@/lib/roomShoppingFilters';

/** Public, active finish names only; no variant prices or private catalogue fields. */
export function useRoomShoppingFinishes(ids: string[]) {
  // Legacy static Trade cards use tp-* identifiers, not public pick UUIDs.
  const stableIds = [...new Set(ids.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))].sort();
  return useQuery({
    queryKey: ['room-shopping-finishes', stableIds],
    enabled: stableIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RoomFinishMap> => {
      const result: RoomFinishMap = {};
      for (let i = 0; i < stableIds.length; i += 100) {
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from('product_fabric_swatches_public')
            .select('pick_id,name').in('pick_id', stableIds.slice(i, i + 100)).eq('is_active', true)
            .order('pick_id').order('fabric_id').range(offset, offset + 999);
          if (error) throw error;
          for (const row of data || []) {
            if (row.pick_id && row.name?.trim()) result[row.pick_id] = [...new Set([...(result[row.pick_id] || []), row.name.trim()])];
          }
          if (!data || data.length < 1000) break;
        }
      }
      return result;
    },
  });
}