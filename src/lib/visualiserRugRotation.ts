/** Saved rug angle in degrees; old scenes remain aligned at zero. */
export function clampRugRotation(value?: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(360, Math.max(0, value)) : 0;
}

export const rugYaw = (degrees?: number): number => clampRugRotation(degrees) * Math.PI / 180;