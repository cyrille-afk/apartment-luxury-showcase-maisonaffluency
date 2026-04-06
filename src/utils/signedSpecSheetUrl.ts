import { supabase } from "@/integrations/supabase/client";

const SPEC_SHEET_BUCKET = "spec-sheets";
const PUBLIC_PATH_REGEX = /\/storage\/v1\/object\/public\/spec-sheets\/(.+)$/;

/**
 * Converts a spec-sheet storage URL (public or otherwise) into a 1-hour signed URL.
 * If the URL isn't a Supabase spec-sheet URL, returns it unchanged.
 */
export async function getSignedSpecSheetUrl(url: string): Promise<string> {
  const match = url.match(PUBLIC_PATH_REGEX);
  if (!match) return url;

  const filePath = decodeURIComponent(match[1]);
  const { data, error } = await supabase.storage
    .from(SPEC_SHEET_BUCKET)
    .createSignedUrl(filePath, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    console.warn("Failed to sign spec sheet URL:", error?.message);
    return url; // fallback to original
  }

  return data.signedUrl;
}
