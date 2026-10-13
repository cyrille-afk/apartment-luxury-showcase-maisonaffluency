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