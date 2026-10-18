import { sharedVisualiserRoom, type SharedVisualiserRoom } from "./sharedVisualiserRoom";
import { z } from "zod";
export type WorkspacePresentation = { title: string; studioName: string; studioLogo: string | null; floorPlanUrl: string | null; views: { id: string; name: string; created_at: string; floorPlanUrl: string | null; bounds: { width: number; depth: number; height: number }; scene: SharedVisualiserRoom | null }[] };
const hostedUrl = z.string().max(10000).url().refine(value => value.startsWith("https://"));
const presentationSchema = z.object({
  title: z.string().min(1).max(120), studioName: z.string(),
  studioLogo: z.union([hostedUrl, z.literal("")]).nullable().transform(value => value || null),
  floorPlanUrl: hostedUrl.nullable(),
  views: z.array(z.object({ id: z.string().uuid(), name: z.string(), created_at: z.string(),
    floorPlanUrl: hostedUrl.nullable(), bounds: z.object({ width: z.number().positive().max(100), depth: z.number().positive().max(100), height: z.number().positive().max(100) }),
    scene: z.unknown(),
  })).max(20),
});
export function parseWorkspacePresentation(value: unknown): WorkspacePresentation {
  const data = presentationSchema.parse(value);
  return { ...data, views: data.views.map(view => {
    const empty = z.object({ objects: z.array(z.unknown()).length(0) }).safeParse(view.scene).success;
    return { ...view, scene: empty ? null : sharedVisualiserRoom(view.scene) };
  }) };
}