import { emptyMoodBudget, isMoodCurrency, type MoodBudgetSettings } from "./moodBoardBudget";
import type { StudioRoomContext } from "./studioRoomContext";

export const savedMoodBudgetKey = (userId: string, boardId: string) => `ma-saved-mood-budget-v1:${userId}:${boardId}`;

export function initialSavedMoodBudget(saved: MoodBudgetSettings | null, room: StudioRoomContext | null, project?: { target_ceiling_cents: number | null; ceiling_currency: string | null } | null): MoodBudgetSettings {
  if (saved) return saved;
  const currency = room?.currency ?? (isMoodCurrency(project?.ceiling_currency) ? project.ceiling_currency : "EUR");
  const target = room ? room.targetCents : project?.target_ceiling_cents;
  return { ...emptyMoodBudget(), currency, roomType: room?.roomType ?? "living", totalEur: target == null ? null : target / 100 };
}