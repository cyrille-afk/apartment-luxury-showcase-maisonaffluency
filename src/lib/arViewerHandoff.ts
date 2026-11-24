import { z } from "zod";
import { absoluteUrl } from "@/config/site";

const label = z.string().max(600);
const handoffSchema = z.object({
  kind: z.enum(["board", "viewing-room"]),
  id: z.string().min(1).max(100),
  context: z.string().max(100).optional(),
  product: z.string().max(100).optional(),
  finish: label.optional(),
  top: label.optional(),
  base: label.optional(),
  size: label.optional(),
  colour: z.string().max(100).optional(),
  axes: z.record(z.string().max(30), z.string().max(100)).optional(),
});

/** Display-only choices; prices, textures, access credentials and saved writes never travel here. */
export type ArViewerHandoff = z.infer<typeof handoffSchema>;

export function arViewerUrl(href: string, handoff?: ArViewerHandoff): string {
  const current = new URL(href);
  if (handoff) current.searchParams.set("arPreview", JSON.stringify(handoffSchema.parse(handoff)));
  return absoluteUrl(`${current.pathname}${current.search}${current.hash}`);
}

export function readArViewerHandoff(href: string): ArViewerHandoff | null {
  try {
    const raw = new URL(href).searchParams.get("arPreview");
    if (!raw || raw.length > 2500) return null;
    const result = handoffSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}