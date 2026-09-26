import { supabase } from "@/integrations/supabase/client";

/** Only these two gallery pins are intentionally public despite their trade-only designer. */
export async function fetchPublicMicMacPins() {
  const { data, error } = await supabase.rpc("public_micmac_gallery_pins");
  if (error) return [];
  return data ?? [];
}

export function mergeGalleryPins<T extends { id: string }>(regular: T[], special: T[]): T[] {
  const byId = new Map(regular.map((pin) => [pin.id, pin]));
  special.forEach((pin) => { if (!byId.has(pin.id)) byId.set(pin.id, pin); });
  return [...byId.values()];
}