import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeaturedPublicDocument {
  id: string;
  title: string;
  brand_name: string;
  file_url: string;
  cover_image_url: string | null;
}

/**
 * Returns the single document currently flagged `is_featured_public = true`
 * in `trade_documents`. If multiple were ever flagged (a partial unique index
 * prevents this at the DB level), the most recently created wins.
 *
 * Readable by anonymous visitors thanks to the dedicated RLS policy
 * "Anyone can view featured public document".
 */
export const useFeaturedPublicDocument = () => {
  const [doc, setDoc] = useState<FeaturedPublicDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("trade_documents")
      .select("id, title, brand_name, file_url, cover_image_url")
      .eq("is_featured_public", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setDoc((data as FeaturedPublicDocument | null) ?? null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { doc, loading };
};
