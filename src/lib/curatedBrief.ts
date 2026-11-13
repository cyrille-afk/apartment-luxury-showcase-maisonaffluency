import type { LayoutBrief } from "./mockAiLayoutService";

export function criteriaBrief(brief: Pick<LayoutBrief, "roomType" | "style" | "totalBudget">): string {
  const styles: Record<LayoutBrief["style"], string> = { "quiet-luxury": "Quiet luxury", "warm-minimal": "Warm minimalism", sculptural: "Sculptural" };
  return `${styles[brief.style]}, ${brief.roomType.replace(/-/g, " ")} room, budget €${new Intl.NumberFormat("en-GB").format(brief.totalBudget)}`;
}

/** Custom prose survives criteria changes; clearing it resumes automatic criteria. */
export function syncCriteriaBrief(text: string, previous: string, next: string): string {
  return !text.trim() || text === previous ? next : text;
}