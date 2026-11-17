import { invokeWithAuthRetry } from "@/lib/invokeWithAuthRetry";

export interface MoodBoardSuggestion {
  product_id: string;
  score: number;
  reason: string;
  title: string;
  subtitle: string;
  image_url: string;
  category: string;
  brand: string;
}

// Returns page-local suggestions only; no concierge events or thread writes.
export async function loadMoodBoardSuggestions(
  productIds: string[],
  context: { anchorIds: string[]; roomType: string; projectId: string | null },
): Promise<MoodBoardSuggestion[]> {
  const { data, error } = await invokeWithAuthRetry("board-recommendations", {
    product_ids: productIds,
    anchor_ids: context.anchorIds.filter(id => productIds.includes(id)),
    room_type: context.roomType,
    source: context.projectId ? "project_tearsheet_mood_board" : "mood_board",
    project_id: context.projectId,
    include_pool: true,
  });
  if (error) throw error;
  return data?.recommendations ?? [];
}