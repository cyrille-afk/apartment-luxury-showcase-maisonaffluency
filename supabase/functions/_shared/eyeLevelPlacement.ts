export type EyeLevelTarget = { x: number; y: number; instruction: string };
export function validEyeLevelTarget(value: unknown): value is EyeLevelTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Record<string, unknown>;
  return [target["x"], target["y"]].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100) &&
    typeof target["instruction"] === "string" && target["instruction"].trim().length > 0 && target["instruction"].length <= 300;
}
export function requireEyeLevelTargets(placements: { product_name: string; target?: unknown }[]): void {
  for (const piece of placements) {
    if (!validEyeLevelTarget(piece.target)) throw new Error(`Assign a placement pin and spatial instruction to ${piece.product_name}.`);
  }
}