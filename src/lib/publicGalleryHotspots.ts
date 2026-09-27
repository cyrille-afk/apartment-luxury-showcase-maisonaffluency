import { supabase } from "@/integrations/supabase/client";

export interface PublicMicMacPin {
  id: string;
  image_identifier: string;
  x_percent: number;
  y_percent: number;
  product_name: string;
  designer_name: string;
  product_image_url: string;
  dimensions: string | null;
  materials: string | null;
}

/** Only these two gallery pins are intentionally public despite their trade-only designer. */
export async function fetchPublicMicMacPins(): Promise<PublicMicMacPin[]> {
  const { data, error } = await supabase.rpc("public_micmac_gallery_pins");
  if (error) return [];
  return (data ?? []) as PublicMicMacPin[];
}

export function mergeGalleryPins<T extends { id: string }>(regular: T[], special: T[]): T[] {
  const byId = new Map(regular.map((pin) => [pin.id, pin]));
  special.forEach((pin) => { if (!byId.has(pin.id)) byId.set(pin.id, pin); });
  return [...byId.values()];
}
