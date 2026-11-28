export type PlanPoint = { x: number; y: number };
export type EyeLevelCamera = { position: PlanPoint; target: PlanPoint };
export const EYE_LEVEL_HEIGHT_M = 1.5;
export const EYE_LEVEL_LENS_MM = 24;

export function validEyeLevelCamera(value: unknown): value is EyeLevelCamera {
  if (!value || typeof value !== "object") return false;
  const camera = value as Record<string, unknown>;
  const point = (p: unknown): p is PlanPoint => {
    if (!p || typeof p !== "object") return false;
    const v = p as Record<string, unknown>;
    return [v["x"], v["y"]].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100);
  };
  return point(camera["position"]) && point(camera["target"]) &&
    Math.hypot(camera["position"].x - camera["target"].x, camera["position"].y - camera["target"].y) >= 2;
}

export function planPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): PlanPoint {
  return { x: Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (clientY - rect.top) / rect.height * 100)) };
}

export function eyeLevelCameraKey(source: string, camera: EyeLevelCamera): string {
  return JSON.stringify([source, camera.position.x, camera.position.y, camera.target.x, camera.target.y, EYE_LEVEL_HEIGHT_M, EYE_LEVEL_LENS_MM]);
}

