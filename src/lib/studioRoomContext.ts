import type { MoodCurrency, MoodRoomType } from "./moodBoardBudget";
export type StudioRoomContext = { roomType: MoodRoomType; currency: MoodCurrency; targetCents: number | null; anchorId?: string | null };
const key = (userId: string, projectId: string) => `ma-studio-room-context-v1:${userId}:${projectId}`;
export function saveStudioRoomContext(userId: string, projectId: string, context: StudioRoomContext) {
  localStorage.setItem(key(userId, projectId), JSON.stringify(context));
}
export function readStudioRoomContext(userId: string, projectId: string, productIds: string[]): StudioRoomContext | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key(userId, projectId)) || "null") as StudioRoomContext | null;
    for (const scope of [projectId, "standalone"]) {
      const draft = JSON.parse(localStorage.getItem(`ma-mood-workspace-v1:${userId}:${scope}`) || "null");
      if (!draft?.settings || !draft.items?.some((item: { id: string }) => productIds.includes(item.id))) continue;
      return {
        roomType: saved?.roomType ?? draft.settings.roomType,
        currency: saved?.currency ?? draft.settings.currency ?? "EUR",
        targetCents: saved ? saved.targetCents : draft.settings.totalEur == null ? null : Math.round(draft.settings.totalEur * 100),
        anchorId: saved?.anchorId ?? draft.settings.anchors?.find((id: string) => productIds.includes(id)) ?? null,
      };
    }
    return saved;
  } catch { return null; }
}
