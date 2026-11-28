import { z } from "zod";
import { viewingRoomSelection, type ViewingRoomChoice, type ViewingRoomSlot } from "./viewingRoom";
import { proposalSelectedFinishes } from "./viewingRoomProposalData";

export const residenceShellSchema = z.object({ label: z.string().trim().min(1).max(120), url: z.string().url().max(2048).refine(value => value.startsWith("https://")) });
export const residenceShellsSchema = z.array(residenceShellSchema);
export type ResidenceShell = z.infer<typeof residenceShellSchema>;
export const visualizationChoiceSchema = z.object({ slot_id: z.string().uuid(), product_id: z.string().uuid(), finish_key: z.string().max(20).optional(), size_key: z.string().max(300).optional(), colourway_id: z.string().max(80).optional(), axis_colours: z.partialRecord(z.enum(["seat", "backrest", "frame"]), z.string().max(80)).optional() });
export type VisualizationChoice = z.infer<typeof visualizationChoiceSchema>;
export function visualizationChoices(slots: ViewingRoomSlot[], choices: Record<string, ViewingRoomChoice>): VisualizationChoice[] {
  return slots.map(slot => { const piece = choices[slot.id] ?? slot; return { slot_id: slot.id, product_id: piece.id, ...(piece.finish_key ? { finish_key: piece.finish_key } : {}), ...(piece.size_key ? { size_key: piece.size_key } : {}), ...(piece.colourway_id ? { colourway_id: piece.colourway_id } : {}), ...(piece.axis_colours ? { axis_colours: piece.axis_colours } : {}) }; });
}
export function approvedVisualizationPieces(slots: ViewingRoomSlot[], choices: VisualizationChoice[]) {
  if (!slots.length || choices.length !== slots.length || new Set(choices.map(choice => choice.slot_id)).size !== slots.length) throw new Error("Choose every collection piece once.");
  return slots.map(slot => {
    const choice = choices.find(row => row.slot_id === slot.id);
    if (!choice) throw new Error("Missing collection piece.");
    return viewingRoomSelection(slot, choice.product_id, choice.finish_key, choice.size_key, choice.colourway_id, choice.axis_colours);
  });
}
export function visualizationPlacements(items: ViewingRoomChoice[]) {
  return items.map(item => ({ product_id: item.id, product_name: item.product_name, brand_name: item.brand_name ?? "", image_url: item.image_url, dimensions: item.dimensions, selected_finishes: proposalSelectedFinishes({ ...item, finish_options: [] }).map(finish => ({ axis: finish.label, name: finish.name, image_url: finish.image_url })) }));
}
export function visualizationSignature(items: ViewingRoomChoice[]) {
  return JSON.stringify(visualizationPlacements(items).map(({ image_url: _image, ...item }) => ({ ...item, selected_finishes: item.selected_finishes.map(({ image_url: _swatch, ...finish }) => finish).sort((a,b) => a.axis.localeCompare(b.axis)) })));
}