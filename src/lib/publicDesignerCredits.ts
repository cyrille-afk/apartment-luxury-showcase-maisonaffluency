import { supabase } from "@/integrations/supabase/client";
import type { CatalogManifestDesigner } from "@/lib/catalogManifest";

export type PublicDesignerCredit = CatalogManifestDesigner & {
  is_independent?: boolean | null;
};

/**
 * Safe public credit fields only. Trade Only makers appear only when at least
 * one individually published product is visible; private biographies and other
 * profile fields remain behind the designers table's existing access rules.
 */
export async function fetchPublicDesignerCredits(): Promise<PublicDesignerCredit[]> {
  const { data, error } = await supabase.rpc("public_catalog_designer_credits");
  if (error) throw error;
  return (data ?? []) as PublicDesignerCredit[];
}
