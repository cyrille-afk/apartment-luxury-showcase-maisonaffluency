import { supabase } from "@/integrations/supabase/client";

/**
 * Private bucket for trade-only / admin-only uploads.
 * Objects here are NOT reachable via a public storage URL — access always
 * goes through a signed URL issued to an authorised session.
 */
export const PRIVATE_TRADE_BUCKET = "trade-private";

/** Folders that must never live in the public `assets` bucket. */
export const PRIVATE_TRADE_FOLDERS = [
  "axonometric-sources",
  "axonometric-submissions",
  "proposal-externals",
] as const;

export function isPrivateTradeFolder(folder: string): boolean {
  return (PRIVATE_TRADE_FOLDERS as readonly string[]).includes(folder);
}

/** Long-lived signed URL (5 years) so persisted references keep resolving. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

/**
 * Uploads a file to the private trade bucket and returns a signed URL.
 * Throws on failure so callers can surface a toast.
 */
export async function uploadPrivateTradeAsset(
  path: string,
  body: Blob | File,
  contentType?: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(PRIVATE_TRADE_BUCKET)
    .upload(path, body, { contentType: contentType || (body as File).type || undefined });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from(PRIVATE_TRADE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signError || !data?.signedUrl) {
    throw signError || new Error("Could not create a signed URL for the uploaded file");
  }
  return data.signedUrl;
}

/**
 * Re-signs a stored private-bucket URL (in case the token expired).
 * Non trade-private URLs are returned unchanged.
 */
export async function resignPrivateTradeUrl(url: string): Promise<string> {
  const match = url.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/trade-private\/([^?]+)/);
  if (!match) return url;
  const path = decodeURIComponent(match[1]);
  const { data } = await supabase.storage
    .from(PRIVATE_TRADE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl || url;
}
