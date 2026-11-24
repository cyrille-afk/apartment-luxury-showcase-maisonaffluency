import type { ViewingRoomChoice } from "./viewingRoom";
import { viewingRoomViewerMaterials } from "./viewingRoom";

export type ViewingRoomProposalSnapshot = { package: string; currency: string; total: number; items: ViewingRoomChoice[] };
export type ViewingRoomProposalContext = { hero?: string | null; logo?: string | null; floorplan?: string | null; specs?: string | null; leadTimeWeeks?: number | null };

/** Only validated line prices enter the presentation; the package target is not its configured total. */
export function proposalConfiguredTotal(snapshot: ViewingRoomProposalSnapshot): number {
  return snapshot.items.reduce((sum, item) => {
    if (item.retail_price == null || !Number.isFinite(item.retail_price) || item.retail_price < 0) throw new Error("A selected piece has no confirmed retail price.");
    return sum + Math.round(item.retail_price * 100);
  }, 0);
}

export function proposalSelectedFinishes(item: ViewingRoomChoice) {
  const seen = new Set<string>();
  return Object.entries(viewingRoomViewerMaterials(item)).flatMap(([axis, material]) => {
    if (axis.startsWith("default-")) return [];
    const identity = `${axis}:${material.id}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const label = axis === "upholstery" ? (item.materials["backrest"] ? "Seat upholstery" : "Upholstery") : axis === "backrest" ? "Backrest leather" : axis === "base" ? "Frame / base" : axis === "top" ? "Tabletop" : material.category || "Selected finish";
    return [{ ...material, axis, label, name: /^\d+$/.test(material.name.trim()) ? `Selected ${material.category || "material"} — name to be confirmed` : material.name }];
  });
}

export function proposalSchedulePages(items: ViewingRoomChoice[]): ViewingRoomChoice[][] {
  return Array.from({ length: Math.ceil(items.length / 2) }, (_, index) => items.slice(index * 2, index * 2 + 2));
}