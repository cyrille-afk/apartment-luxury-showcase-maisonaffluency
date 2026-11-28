import { z } from "zod";
import { ROOM_TYPES } from "./roomZone";
import type { VisualizationChoice } from "./residenceVisualization";

export const roomTypeSchema = z.enum(Object.keys(ROOM_TYPES) as [keyof typeof ROOM_TYPES, ...(keyof typeof ROOM_TYPES)[]]);
export const residenceRoomSchema = z.object({ id: z.string().uuid(), room_name: z.string(), room_type: roomTypeSchema, shell_url: z.string().url(), render_url: z.string().url().nullable(), slot_ids: z.array(z.string().uuid()), selection_signature: z.string(), gallery_views: z.array(z.object({ label: z.string(),url: z.string().url() })).optional() });
export type ResidenceRoom = z.infer<typeof residenceRoomSchema>;
export function roomChoices(choices: VisualizationChoice[], slotIds: string[]) {
  const ids = new Set(slotIds);
  return choices.filter(choice => ids.has(choice.slot_id));
}
export function roomSelectionKey(choices: VisualizationChoice[], slotIds: string[]) {
  return JSON.stringify(roomChoices(choices,slotIds).sort((a,b) => a.slot_id.localeCompare(b.slot_id)).map(c => ({ slot_id: c.slot_id, product_id: c.product_id, finish_key: c.finish_key ?? null, size_key: c.size_key ?? null, colourway_id: c.colourway_id ?? null, axis_colours: Object.fromEntries(Object.entries(c.axis_colours ?? {}).sort(([a],[b]) => a.localeCompare(b))) })));
}