/** Audited source revisions only: source CAD units are not glTF metres. */
const CORRECTIONS = [
  { path: "/glb-models/f72b4185-9eeb-4ec0-b862-0972abc93a9f/default-1791609555869.glb", metresPerUnit: .001 },
  { path: "/glb-models/fd8c2682-d8a1-48fe-b110-d22209cbcce7/default-1791611289330.glb", metresPerUnit: .01 },
] as const;

export function arModelTransform(url: string, scale?: string | null) {
  const path = url.split(/[?#]/)[0] ?? "";
  const correction = CORRECTIONS.find(entry => path.endsWith(entry.path));
  const multiplier = correction?.metresPerUnit ?? 1;
  const axes = (scale || "1 1 1").trim().split(/\s+/).map(Number);
  const valid = axes.length === 3 && axes.every(value => Number.isFinite(value) && value > 0);
  return {
    scale: (valid ? axes : [1, 1, 1]).map(value => value * multiplier).join(" "),
    orientation: correction ? "0deg -90deg 0deg" : "0deg 0deg 0deg",
    corrected: Boolean(correction),
  };
}