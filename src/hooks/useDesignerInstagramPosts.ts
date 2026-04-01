import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DesignerInstagramPost {
  id: string;
  designer_id: string;
  post_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export function useDesignerInstagramPosts(designerId: string | undefined) {
  return useQuery({
    queryKey: ["designer-instagram-posts", designerId],
    enabled: !!designerId,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_instagram_posts" as any)
        .select("*")
        .eq("designer_id", designerId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as DesignerInstagramPost[]) || [];
    },
  });
}
