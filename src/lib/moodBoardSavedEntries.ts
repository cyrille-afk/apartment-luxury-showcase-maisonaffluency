export interface MoodBoardSavedEntry {
  id: string;
  board_id: string;
  product_id: string;
  variant_label: string | null;
  wood_label: string | null;
  fabric_label: string | null;
  procurement_quote_id: string | null;
  source_quote_item_id: string | null;
}

export function removableMoodBoardEntry(entry: MoodBoardSavedEntry): boolean {
  return !entry.procurement_quote_id && !entry.source_quote_item_id;
}

export function moodBoardEntryFinish(entry: MoodBoardSavedEntry): string {
  return [entry.variant_label, entry.wood_label, entry.fabric_label].filter(Boolean).join(" / ") || "Catalogue default";
}