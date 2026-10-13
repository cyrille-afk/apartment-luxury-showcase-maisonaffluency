/** Lightweight settings shared by the page and lazy-loaded Three.js scene. */
export type CeilingSettings = { ceilingHeight?: number | null; ceilingThickness?: number; ceilingOpening?: number };
export const CEILING_CONTROLS = {
  height: { min: 1, max: 6, step: 0.05 },
  thickness: { min: 0.05, max: 0.5, step: 0.01, default: 0.15 },
  opening: { min: 30, max: 95, step: 1, default: 90 },
};
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export const clampCeilingHeight = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? clamp(value, 1, 6, 4.25) : null;
export const clampCeilingThickness = (value: unknown) => clamp(value, 0.05, 0.5, 0.15);
export const clampCeilingOpening = (value: unknown) => clamp(value, 30, 95, 90);