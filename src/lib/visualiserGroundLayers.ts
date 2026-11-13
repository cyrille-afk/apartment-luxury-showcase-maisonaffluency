/** Metres above the shared Y=0 floor; overlays never share its depth. */
export const GROUND_LAYERS = { floor: 0, contact: 0.002, grid: 0.003, catcher: 0.003 } as const;
export const GROUND_OVERLAY_OFFSET = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } as const;
export const KEY_SHADOW = { bias: -0.0005, normalBias: 0.02, mapSize: 2048, cameraExtent: 15 } as const;
export const CONTACT_SHADOW = { minimumScale: 22, opacity: 0.25, blur: 2.5 } as const;
export const FURNITURE_CONTACT_LAYER = 1;
