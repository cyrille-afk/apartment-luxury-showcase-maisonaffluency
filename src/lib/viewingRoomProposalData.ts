import type { ViewingRoomChoice } from "./viewingRoom";
import { viewingRoomViewerMaterials } from "./viewingRoom";

export type ViewingRoomProposalSnapshot = { package: string; currency: string; total: number; items: ViewingRoomChoice[] };
export type ViewingRoomProposalContext = {
  hero?: string | null;
  logo?: string | null;
  floorplan?: string | null;
  specs?: string | null;
  leadTimeWeeks?: number | null;
  clientName?: string | null;
  projectNotes?: string | null;
  axonometricRenderUrl?: string | null;
  walkthroughUrl?: string | null;
};

export function safeProposalUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("https://") || trimmed.startsWith("http://") || trimmed.startsWith("/__l5e/") ? trimmed : null;
}

export const PROPOSAL_CLIENT_NAME_MAX = 120;
export const PROPOSAL_NOTES_MAX = 500;

export function normalizeProposalDetails(input: { clientName?: string | null; projectNotes?: string | null }) {
  const name = (input.clientName ?? "").replace(/\s+/g, " ").trim().slice(0, PROPOSAL_CLIENT_NAME_MAX);
  const notes = (input.projectNotes ?? "").replace(/\r\n?/g, "\n").trim().slice(0, PROPOSAL_NOTES_MAX);
  return { ...(name ? { clientName: name } : {}), ...(notes ? { projectNotes: notes } : {}) };
}

/** Only validated line prices enter the presentation; the package target is not its configured total. Unpriced pieces stay out of the sum — never invented. */
export function proposalConfiguredTotal(snapshot: ViewingRoomProposalSnapshot): number {
  return snapshot.items.reduce((sum, item) => {
    if (item.retail_price == null || !Number.isFinite(item.retail_price) || item.retail_price < 0) return sum;
    return sum + Math.round(item.retail_price * 100);
  }, 0);
}

export function proposalHasUnpricedItems(snapshot: ViewingRoomProposalSnapshot): boolean {
  return snapshot.items.some(item => item.retail_price == null || !Number.isFinite(item.retail_price) || item.retail_price < 0);
}

export function proposalSelectedFinishes(item: ViewingRoomChoice) {
  const seen = new Set<string>();
  const materials = viewingRoomViewerMaterials(item);
  const shared = Boolean(materials["top"] && materials["base"] && materials["top"].id === materials["base"].id);
  return Object.entries(materials).flatMap(([axis, material]) => {
    if (axis.startsWith("default-")) return [];
    if (shared && axis === "base") return [];
    const identity = `${axis}:${material.id}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    const label = shared && axis === "top" ? "Finish" : axis === "upholstery" ? (materials["backrest"] ? "Seat upholstery" : "Upholstery") : axis === "backrest" ? "Backrest leather" : axis === "base" ? "Frame / base" : axis === "top" ? "Tabletop" : material.category || "Selected finish";
    return [{ ...material, axis, label, name: /^\d+$/.test(material.name.trim()) ? `Selected ${material.category || "material"} — name to be confirmed` : material.name }];
  });
}

export function proposalSchedulePages(items: ViewingRoomChoice[]): ViewingRoomChoice[][] {
  return Array.from({ length: Math.ceil(items.length / 2) }, (_, index) => items.slice(index * 2, index * 2 + 2));
}