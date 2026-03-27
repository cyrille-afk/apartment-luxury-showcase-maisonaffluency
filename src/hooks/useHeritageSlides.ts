import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HeritageSlide {
  id: string;
  designer_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

export function useHeritageSlides(designerId: string | undefined) {
  return useQuery({
    queryKey: ["heritage-slides", designerId],
    queryFn: async () => {
      if (!designerId) return [];
      const { data, error } = await supabase
        .from("designer_heritage_slides" as any)
        .select("*")
        .eq("designer_id", designerId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as HeritageSlide[];
    },
    enabled: !!designerId,
  });
}
