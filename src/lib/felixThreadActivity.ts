export type FelixThreadActivity = {
  userMessages: number;
  felixMessages: number;
  savedCards: number;
};

// Historical messages do not record whether an assistant reply was automatic.
export function felixThreadActivity(timeline: unknown): FelixThreadActivity {
  const activity = { userMessages: 0, felixMessages: 0, savedCards: 0 };
  if (!Array.isArray(timeline)) return activity;
  const cards = new Set(["proposal", "quote_proposal", "ffe_proposal", "viz_brief", "spec_schedule", "layout_options", "proactive_tearsheet", "quote_card", "quote_summary"]);
  for (const item of timeline) {
    if (!item || typeof item !== "object") continue;
    if (item.kind === "msg" && typeof item.content === "string" && item.content.trim()) {
      if (item.role === "user") activity.userMessages += 1;
      if (item.role === "assistant") activity.felixMessages += 1;
    } else if (cards.has(item.kind)) {
      activity.savedCards += 1;
    }
  }
  return activity;
}

export function felixActivityTimestamp(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}