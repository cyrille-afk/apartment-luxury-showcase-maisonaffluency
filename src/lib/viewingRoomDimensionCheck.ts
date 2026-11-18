export type ModelMeasurements = { w: number; d: number; h: number };
export type ModelDimensionCheck = {
  status: "verified" | "mismatch" | "invalid" | "unconfirmed";
  measured: ModelMeasurements; expected: ModelMeasurements | null;
  axes: string[];
};
/** Compare fitted, upright metre bounds, not CAD source units or placement yaw. */
export function checkViewingRoomDimensions(measured: ModelMeasurements, expected: ModelMeasurements | null): ModelDimensionCheck {
  const axes = ["w", "d", "h"] as const;
  if (axes.some(axis => !Number.isFinite(measured[axis]) || measured[axis] <= 0)) return { status: "invalid", measured, expected, axes: [] };
  if (!expected || axes.some(axis => !Number.isFinite(expected[axis]) || expected[axis] <= 0)) return { status: "unconfirmed", measured, expected: null, axes: [] };
  const unexpected = axes.filter(axis => Math.abs(measured[axis] - expected[axis]) > Math.max(.05, expected[axis] * .25));
  return { status: unexpected.length ? "mismatch" : "verified", measured, expected, axes: unexpected };
}