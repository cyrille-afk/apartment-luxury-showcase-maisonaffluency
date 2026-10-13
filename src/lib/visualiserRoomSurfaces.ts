export type RoomFloorFinish = "oak-chevron" | "micro-cement" | "none";

export function roomFloorFinish(value: unknown): RoomFloorFinish {
  return value === "micro-cement" || value === "none" ? value : "oak-chevron";
}

/** Clamp a persisted floor-glare value (0–100) to a safe slider range. */
export function clampFloorGlare(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50;
}

/** Full cyclorama wall height in metres (the 100% reference). */
export const WALL_FULL_HEIGHT_M = 4.5;

/** Clamp a persisted wall-height percentage (20–100) to a safe slider range. */
export function clampWallHeight(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(20, Math.round(value))) : 100;
}

/** Clamp a persisted wall finish intensity (0–100; 100 = the finish as designed). */
export function clampWallFinishIntensity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 100;
}

/** Plaster wall colour palette — soft architectural neutrals plus two accents. */
export const WALL_COLORS = [
  { key: "warm-white", label: "Warm White", hex: "#f4efe7" },
  { key: "soft-ivory", label: "Soft Ivory", hex: "#efe7d6" },
  { key: "greige", label: "Greige", hex: "#d8d0c2" },
  { key: "stone-grey", label: "Stone Grey", hex: "#b9b4ab" },
  { key: "terracotta-clay", label: "Terracotta Clay", hex: "#c9a68c" },
  { key: "sage", label: "Sage", hex: "#b7bfae" },
  { key: "midnight", label: "Midnight", hex: "#3a3f44" },
] as const;

/** Preset keys plus "custom", which resolves through a user-entered hex value. */
export type RoomWallColor = (typeof WALL_COLORS)[number]["key"] | "custom";

export function roomWallColor(value: unknown): RoomWallColor {
  return value === "custom" || WALL_COLORS.some((c) => c.key === value) ? (value as RoomWallColor) : "warm-white";
}

/** Validate a hex colour (#rgb or #rrggbb) and expand the short form. */
export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return undefined;
  return trimmed.length === 4
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed;
}

export function wallColorHex(color: RoomWallColor, customHex?: string | null): string {
  if (color === "custom") return normalizeHexColor(customHex) ?? WALL_COLORS[0].hex;
  return WALL_COLORS.find((c) => c.key === color)?.hex ?? WALL_COLORS[0].hex;
}

/** Plaster finish presets: roughness, reflection strength and surface relief. */
export const WALL_FINISHES = [
  { key: "matte", label: "Matte Plaster", roughness: 0.95, envMapIntensity: 0.2, bumpScale: 0.002 },
  { key: "satin", label: "Satin Lime", roughness: 0.7, envMapIntensity: 0.35, bumpScale: 0.0015 },
  { key: "polished", label: "Polished Venetian", roughness: 0.45, envMapIntensity: 0.5, bumpScale: 0.001 },
] as const;

export type RoomWallFinish = (typeof WALL_FINISHES)[number]["key"];

export function roomWallFinish(value: unknown): RoomWallFinish {
  return WALL_FINISHES.some((f) => f.key === value) ? (value as RoomWallFinish) : "matte";
}

export function wallFinishSpec(finish: RoomWallFinish) {
  return WALL_FINISHES.find((f) => f.key === finish) ?? WALL_FINISHES[0];
}
/** Area-rug wool colours. */
export const RUG_COLORS = [
  { key: "cream", label: "Cream Wool", hex: "#efe6d4" },
  { key: "oatmeal", label: "Oatmeal", hex: "#d6c8b0" },
  { key: "stone", label: "Stone Grey", hex: "#b4aea4" },
  { key: "sage", label: "Sage", hex: "#a9b39c" },
  { key: "terracotta", label: "Terracotta", hex: "#b98a6c" },
  { key: "charcoal", label: "Charcoal", hex: "#55524e" },
  { key: "navy", label: "Ink Navy", hex: "#3c4558" },
] as const;
export type RugColor = (typeof RUG_COLORS)[number]["key"];
export function rugColor(value: unknown): RugColor {
  return RUG_COLORS.some((c) => c.key === value) ? (value as RugColor) : "cream";
}
export function rugColorHex(value: unknown): string {
  return RUG_COLORS.find((c) => c.key === rugColor(value))!.hex;
}

/** Weave structure of the rug surface. */
export const RUG_WEAVES = [
  { key: "loop", label: "Loop Pile" },
  { key: "flatweave", label: "Basket Flatweave" },
  { key: "herringbone", label: "Herringbone Berber" },
  { key: "ribbed", label: "Ribbed Cord" },
] as const;
export type RugWeave = (typeof RUG_WEAVES)[number]["key"];
export function rugWeave(value: unknown): RugWeave {
  return RUG_WEAVES.some((w) => w.key === value) ? (value as RugWeave) : "loop";
}

/** Pile depth, 0–100 (0 = flat/low, 100 = deep plush). Default 50. */
export function clampRugPile(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50;
}
