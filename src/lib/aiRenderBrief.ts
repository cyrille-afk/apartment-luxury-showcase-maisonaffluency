export type CreativeBriefOrigin = "queue" | "concierge" | "history" | null;

export interface ScopedCreativeBriefState {
  brief: Record<string, string>;
  sourceUrl: string | null;
  origin: CreativeBriefOrigin;
}

export const EMPTY_SCOPED_BRIEF: ScopedCreativeBriefState = {
  brief: {},
  sourceUrl: null,
  origin: null,
};

export function hasActiveCreativeBrief(brief: Record<string, string> | null | undefined): boolean {
  if (!brief) return false;
  return Object.values(brief).some((v) => typeof v === "string" && v.trim() !== "" && v !== "no_preference");
}

function sanitizeBriefRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim() !== "") {
      clean[key] = value;
    }
  }
  return clean;
}

function parseOrigin(raw: unknown): CreativeBriefOrigin {
  return raw === "queue" || raw === "concierge" || raw === "history" ? raw : null;
}

/**
 * Restore a persisted Creative Brief ONLY when it is explicitly bound to the
 * current source image (or is an unbound Concierge handoff waiting for its
 * first upload). Legacy/orphaned drafts without a matching source binding are
 * dropped so an old queue brief can never hijack a newly uploaded floor plan.
 */
export function restoreScopedBrief(
  savedDraft: Record<string, unknown> | null | undefined,
  currentSourceUrl: string | null,
): ScopedCreativeBriefState {
  if (!savedDraft || typeof savedDraft !== "object") return EMPTY_SCOPED_BRIEF;
  const brief = sanitizeBriefRecord(savedDraft["activeBrief"]);
  if (!hasActiveCreativeBrief(brief)) return EMPTY_SCOPED_BRIEF;

  const origin = parseOrigin(savedDraft["activeBriefOrigin"]);
  const boundSource =
    typeof savedDraft["activeBriefSourceUrl"] === "string" && savedDraft["activeBriefSourceUrl"].trim() !== ""
      ? savedDraft["activeBriefSourceUrl"]
      : null;

  if (origin === "concierge" && !boundSource) {
    return { brief, sourceUrl: null, origin: "concierge" };
  }

  if (boundSource && currentSourceUrl && boundSource === currentSourceUrl) {
    return { brief, sourceUrl: boundSource, origin };
  }

  return EMPTY_SCOPED_BRIEF;
}

/**
 * Update Creative Brief binding when the user uploads, clears, or switches the
 * source image. Any fresh source replaces/clears briefs from prior requests,
 * except an unbound Concierge handoff which attaches once to the first upload.
 */
export function resolveBriefAfterSourceChange(
  current: ScopedCreativeBriefState,
  nextSourceUrl: string | null,
): ScopedCreativeBriefState {
  if (!nextSourceUrl) return EMPTY_SCOPED_BRIEF;
  if (current.origin === "concierge" && !current.sourceUrl && hasActiveCreativeBrief(current.brief)) {
    return { brief: current.brief, sourceUrl: nextSourceUrl, origin: "concierge" };
  }
  if (current.sourceUrl && current.sourceUrl === nextSourceUrl && hasActiveCreativeBrief(current.brief)) {
    return current;
  }
  return EMPTY_SCOPED_BRIEF;
}