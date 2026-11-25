export type RenderMode = "elevation_to_axo" | "section_to_axo" | "stylize" | "composite" | "3d_to_cad" | "cad_overlay";
export type QualityTier = "draft" | "standard" | "premium";
export type RenderHistoryKind = "generation" | "ai_edit" | "scene_edit";
export type ProjectScopeFilter = "all" | "unassigned" | string;

export interface RenderHistoryProduct {
  product_name: string;
  brand_name: string;
  image_url: string;
  dimensions?: string;
  materials?: string;
}

export interface RenderHistoryMetadata {
  sourceProduct?: RenderHistoryProduct | null;
  activeBrief?: Record<string, string>;
  overlayImages?: string[];
  technicalDrawingUrl?: string | null;
  lockedLayoutUrl?: string | null;
  lightingStrength?: number;
  text?: string;
}

export interface AiRenderHistoryEntry {
  id: string;
  created_by: string;
  project_id: string | null;
  project_name: string | null;
  proposal_id: string | null;
  request_id: string | null;
  source_image_url: string | null;
  result_image_url: string;
  mode: string;
  style_preset: string | null;
  style_prompt: string | null;
  quality_tier: QualityTier;
  prompt_note: string | null;
  kind: RenderHistoryKind;
  metadata: RenderHistoryMetadata;
  created_at: string;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const VALID_MODES = new Set<RenderMode>([
  "elevation_to_axo",
  "section_to_axo",
  "stylize",
  "composite",
  "3d_to_cad",
  "cad_overlay",
]);

export function isRenderMode(value: string | null | undefined): value is RenderMode {
  return typeof value === "string" && VALID_MODES.has(value as RenderMode);
}

const MODE_LABELS: Record<string, string> = {
  elevation_to_axo: "Elevation → Axo",
  section_to_axo: "Section → Axo",
  stylize: "Stylize",
  composite: "Composite",
  "3d_to_cad": "3D → CAD",
  cad_overlay: "CAD Overlay",
  freeform: "AI Edit",
  product_swap: "Product Swap",
  apply_texture: "Texture Swap",
};

export function renderModeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode.replace(/_/g, " ");
}

export function renderKindLabel(kind: RenderHistoryKind): string {
  if (kind === "ai_edit") return "AI Edit";
  if (kind === "scene_edit") return "Scene Edit";
  return "Generation";
}

export function filterRenderHistoryByScope(
  entries: readonly AiRenderHistoryEntry[],
  scope: ProjectScopeFilter,
): AiRenderHistoryEntry[] {
  if (scope === "all") return [...entries];
  if (scope === "unassigned") return entries.filter((entry) => entry.project_id === null);
  return entries.filter((entry) => entry.project_id === scope);
}

export function toggleCompareSelection(current: readonly string[], id: string): string[] {
  if (current.includes(id)) return current.filter((item) => item !== id);
  if (current.length < 2) return [...current, id];
  const second = current[1];
  return second ? [second, id] : [id];
}

export function resolveComparePair(
  entries: readonly AiRenderHistoryEntry[],
  selectedIds: readonly string[],
): [AiRenderHistoryEntry, AiRenderHistoryEntry] | null {
  const firstId = selectedIds[0];
  const secondId = selectedIds[1];
  if (!firstId || !secondId || firstId === secondId) return null;
  const first = entries.find((entry) => entry.id === firstId);
  const second = entries.find((entry) => entry.id === secondId);
  if (!first || !second) return null;
  return [first, second];
}

export function parseRenderMetadata(raw: unknown): RenderHistoryMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const meta: RenderHistoryMetadata = {};
  if (obj["sourceProduct"] && typeof obj["sourceProduct"] === "object" && !Array.isArray(obj["sourceProduct"])) {
    const p = obj["sourceProduct"] as Record<string, unknown>;
    if (typeof p["product_name"] === "string" && typeof p["brand_name"] === "string" && typeof p["image_url"] === "string") {
      const prod: RenderHistoryProduct = {
        product_name: p["product_name"],
        brand_name: p["brand_name"],
        image_url: p["image_url"],
      };
      if (typeof p["dimensions"] === "string") prod.dimensions = p["dimensions"];
      if (typeof p["materials"] === "string") prod.materials = p["materials"];
      meta.sourceProduct = prod;
    }
  }
  if (obj["activeBrief"] && typeof obj["activeBrief"] === "object" && !Array.isArray(obj["activeBrief"])) {
    const brief: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj["activeBrief"] as Record<string, unknown>)) {
      if (typeof v === "string") brief[k] = v;
    }
    meta.activeBrief = brief;
  }
  if (Array.isArray(obj["overlayImages"])) {
    meta.overlayImages = obj["overlayImages"].filter((item): item is string => typeof item === "string");
  }
  if (typeof obj["technicalDrawingUrl"] === "string") meta.technicalDrawingUrl = obj["technicalDrawingUrl"];
  if (typeof obj["lockedLayoutUrl"] === "string") meta.lockedLayoutUrl = obj["lockedLayoutUrl"];
  if (typeof obj["lightingStrength"] === "number" && Number.isFinite(obj["lightingStrength"])) {
    meta.lightingStrength = obj["lightingStrength"];
  }
  if (typeof obj["text"] === "string") meta.text = obj["text"];
  return meta;
}

export interface RestoredStudioState {
  projectId: string | null;
  sourceImage: string | null;
  resultImageUrl: string;
  mode: RenderMode;
  stylePrompt: string;
  qualityTier: QualityTier;
  sourceProduct: RenderHistoryProduct | null;
  activeBrief: Record<string, string>;
  overlayImages: string[];
  technicalDrawingUrl: string | null;
  lockedLayoutUrl: string | null;
  lightingStrength: number;
  text: string;
}

export function extractRestorePayload(
  entry: AiRenderHistoryEntry,
  defaultStylePrompt: string,
): RestoredStudioState {
  const meta = parseRenderMetadata(entry.metadata);
  const qualityTier: QualityTier =
    entry.quality_tier === "draft" || entry.quality_tier === "premium" ? entry.quality_tier : "standard";
  return {
    projectId: entry.project_id,
    sourceImage: entry.source_image_url || entry.result_image_url,
    resultImageUrl: entry.result_image_url,
    mode: isRenderMode(entry.mode) ? entry.mode : "elevation_to_axo",
    stylePrompt: entry.style_prompt || defaultStylePrompt,
    qualityTier,
    sourceProduct: meta.sourceProduct ?? null,
    activeBrief: meta.activeBrief ?? {},
    overlayImages: meta.overlayImages ?? [],
    technicalDrawingUrl: meta.technicalDrawingUrl ?? null,
    lockedLayoutUrl: meta.lockedLayoutUrl ?? null,
    lightingStrength: meta.lightingStrength ?? 80,
    text: meta.text ?? entry.prompt_note ?? "",
  };
}

export function buildImageStudioHref(opts: {
  proposalId?: string | null;
  projectId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (isValidUuid(opts.proposalId)) params.set("proposalId", opts.proposalId);
  if (isValidUuid(opts.projectId)) params.set("project", opts.projectId);
  const query = params.toString();
  return query ? `/tools/ai-render-studio?${query}` : "/tools/ai-render-studio";
}