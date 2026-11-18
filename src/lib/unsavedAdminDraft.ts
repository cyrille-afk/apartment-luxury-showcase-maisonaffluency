import type { ViewingRoomPackageDraft } from "@/lib/viewingRoomPackages";

/**
 * The Developer Viewing Room Manager keeps its edits in local state until the
 * matching save control is used, so leaving the project would silently drop
 * them. These pure predicates decide whether anything actually differs from
 * the saved rows, and the tiny registry below lets the page-level navigation
 * guard ask without prop-drilling through the manager.
 */

export type DeveloperDraft = { developer_name: string; developer_logo_url: string; hero_image_url: string };
export type SavedDeveloper = { developer_name: string; developer_logo_url: string | null; hero_image_url: string | null } | null;
export type LayoutDraft = { name: string; floorplan_url: string; specs_label: string; room_environment_glb: string };
export type SavedLayout = { name: string; floorplan_url: string | null; specs_label: string | null; room_environment_glb: string | null } | null;
export type SavedPackageRow = {
  moodboard_id: string;
  tier_name: string;
  package_price: number | string;
  currency: string;
  description: string | null;
  lead_time_weeks: number | string | null;
  allow_alternatives: boolean | null;
};

const text = (value: unknown) => (value == null ? "" : String(value)).trim();
const price = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : text(value);
};
const weeks = (value: unknown) => text(value);
const swaps = (value: unknown) => (value == null ? true : Boolean(value));

export function developerDraftDirty(draft: DeveloperDraft, saved: SavedDeveloper): boolean {
  if (!saved) {
    return Boolean(text(draft.developer_name) || text(draft.developer_logo_url) || text(draft.hero_image_url));
  }
  return (
    text(draft.developer_name) !== text(saved.developer_name) ||
    text(draft.developer_logo_url) !== text(saved.developer_logo_url) ||
    text(draft.hero_image_url) !== text(saved.hero_image_url)
  );
}

export function layoutDraftDirty(draft: LayoutDraft, saved: SavedLayout): boolean {
  if (!saved) {
    return Boolean(
      text(draft.name) || text(draft.floorplan_url) || text(draft.specs_label) || text(draft.room_environment_glb),
    );
  }
  return (
    text(draft.name) !== text(saved.name) ||
    text(draft.floorplan_url) !== text(saved.floorplan_url) ||
    text(draft.specs_label) !== text(saved.specs_label) ||
    text(draft.room_environment_glb) !== text(saved.room_environment_glb)
  );
}

function packageKey(row: {
  moodboard_id: string;
  tier_name: string;
  package_price: number | string;
  currency: string;
  description: string | null;
  lead_time_weeks?: number | string | null;
  allow_alternatives?: boolean | null;
}): string {
  return JSON.stringify([
    text(row.moodboard_id),
    text(row.tier_name),
    price(row.package_price),
    text(row.currency).toUpperCase(),
    text(row.description),
    weeks(row.lead_time_weeks),
    swaps(row.allow_alternatives),
  ]);
}

/** Package drafts publish in list order, so a re-order is a real change. */
export function packagesDraftDirty(drafts: ViewingRoomPackageDraft[], saved: SavedPackageRow[]): boolean {
  if (drafts.length !== saved.length) return true;
  return drafts.some((row, index) => packageKey(row) !== packageKey(saved[index]));
}

type DirtyCheck = () => boolean;

let activeCheck: DirtyCheck | null = null;

/** Registers the mounted manager's dirty check; the returned function clears it. */
export function registerUnsavedAdminDraft(check: DirtyCheck): () => void {
  activeCheck = check;
  return () => {
    if (activeCheck === check) activeCheck = null;
  };
}

export function hasUnsavedAdminDraft(): boolean {
  return activeCheck?.() === true;
}
