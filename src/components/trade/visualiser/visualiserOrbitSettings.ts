/** Shared interaction limits; calibrated photos alone retain their fixed camera. */
export const VISUALISER_ORBIT_SETTINGS = {
  enableZoom: true,
  enablePan: true,
  enableRotate: true,
  minDistance: 1.5,
  maxDistance: 24,
} as const;