import { supabase } from "@/integrations/supabase/client";

/** Price lists live in the private `price-lists` bucket; only admins can read it (storage RLS). */
export const PRICE_LIST_BUCKET = "price-lists";
const PRIVATE_PREFIX = `private:${PRICE_LIST_BUCKET}/`;

export const isPrivateFileUrl = (url: string | null | undefined) => !!url && url.startsWith("private:");

/** Short-lived signed URL; fails for anyone who is not an admin. */
export async function signPriceListUrl(storagePath: string, seconds = 60): Promise<string> {
  const { data, error } = await supabase.storage.from(PRICE_LIST_BUCKET).createSignedUrl(storagePath, seconds);
  if (error || !data?.signedUrl) throw new Error("This price list is restricted to administrators.");
  return data.signedUrl;
}

/** Copies a public file into private storage and removes the public copy when it was in our assets bucket. */
export async function moveToPrivatePriceList(docId: string, publicUrl: string): Promise<{ storage_path: string; file_url: string }> {
  const res = await fetch(publicUrl);
  if (!res.ok) throw new Error("Could not read the uploaded file.");
  const blob = await res.blob();
  const ext = (publicUrl.split("?")[0].split(".").pop() || "pdf").toLowerCase();
  const path = `${docId}.${ext}`;
  const { error } = await supabase.storage.from(PRICE_LIST_BUCKET).upload(path, blob, {
    contentType: blob.type || "application/pdf",
    upsert: true,
  });
  if (error) throw error;
  const m = publicUrl.match(/\/object\/public\/assets\/(.+)$/);
  if (m) await supabase.storage.from("assets").remove([decodeURIComponent(m[1].split("?")[0])]);
  return { storage_path: path, file_url: `${PRIVATE_PREFIX}${path}` };
}
