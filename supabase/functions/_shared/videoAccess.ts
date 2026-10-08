// Walkthrough video access rules — shared by the video-generate guard and its tests.
// Admin/Platinum: unlimited, no credit used. Gold: 1 included render per calendar
// month, then purchased credits. Silver: purchased credits only.
export type VideoTier = "silver" | "gold" | "platinum";
export const GOLD_MONTHLY_INCLUDED = 1;
export const VIDEO_PASS_PRICE_EUR = 15;

export interface VideoAccessInput {
  isAdmin: boolean;
  tier: VideoTier;
  balance: number;
  goldMonth: string | null;
  goldMonthUsed: number;
  month: string; // YYYY-MM (UTC)
}

export type VideoAccess =
  | { allowed: true; consumes: null; reason: "admin" | "platinum" }
  | { allowed: true; consumes: "gold_monthly" | "token" }
  | { allowed: false; reason: "purchase_required" };

export const normalizeTier = (raw: unknown): VideoTier =>
  raw === "gold" || raw === "platinum" ? raw : "silver";

export const currentMonth = (d = new Date()) => d.toISOString().slice(0, 7);

export function goldIncludedLeft(i: Pick<VideoAccessInput, "goldMonth" | "goldMonthUsed" | "month">) {
  const used = i.goldMonth === i.month ? i.goldMonthUsed : 0;
  return Math.max(0, GOLD_MONTHLY_INCLUDED - used);
}

export function decideVideoAccess(i: VideoAccessInput): VideoAccess {
  if (i.isAdmin) return { allowed: true, consumes: null, reason: "admin" };
  if (i.tier === "platinum") return { allowed: true, consumes: null, reason: "platinum" };
  if (i.tier === "gold" && goldIncludedLeft(i) > 0) return { allowed: true, consumes: "gold_monthly" };
  if (i.balance > 0) return { allowed: true, consumes: "token" };
  return { allowed: false, reason: "purchase_required" };
}
