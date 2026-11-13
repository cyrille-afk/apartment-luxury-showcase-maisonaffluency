/** Shared physical render values; scene preferences remain independently adjustable. */
export const ARCHITECTURAL_RENDERING = {
  keyIntensity: 1.8,
  keyPosition: [-6, 4, 6] as [number, number, number],
  aoRadius: 0.6,
  aoIntensity: 1.4,
  aoDistanceFalloff: 0.8,
  bloomThreshold: 1.1,
  bloomIntensity: 0.15,
  shadowGapHeight: 0.04,
  shadowGapRecess: 0.012,
  shadowGapColor: "#55504a",
} as const;