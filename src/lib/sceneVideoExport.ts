import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";
import type { CinematicPath } from "@/hooks/useCinematicPath";

/**
 * Bundles a curated scene + camera path + text brief for an external
 * video-to-video render (Runway Gen-3 / Luma, to be bound later).
 * Prices and budget are stripped: the render vendor needs geometry, not trade figures.
 */
export const VIDEO_RENDER_WEBHOOK_PLACEHOLDER = "https://example.invalid/video-render-webhook";
const WEBHOOK = (import.meta.env.VITE_VIDEO_RENDER_WEBHOOK_URL as string | undefined) || VIDEO_RENDER_WEBHOOK_PLACEHOLDER;

export interface SceneVideoPayload {
  version: 1;
  createdAt: string;
  brief: string;
  units: { length: "m"; angle: "rad" };
  scene: {
    roomDimensions: AICuratedSceneSchema["roomDimensions"];
    architecturalAnchors: AICuratedSceneSchema["architecturalAnchors"];
    assets: Array<Omit<AICuratedSceneSchema["curatedAssets"][number], "priceAtCuration">>;
  };
  camera: { fovDeg: number; durationSec: number; fps: number; lookAt: [number, number, number]; path: Array<[number, number, number]> };
  render: { provider: "runway-gen3" | "luma"; style: "hyper-photorealistic"; aspectRatio: "16:9" };
}

export function buildSceneVideoPayload(scene: AICuratedSceneSchema, path: CinematicPath, brief: string, fovDeg = 45): SceneVideoPayload {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    brief: brief.trim().slice(0, 2000),
    units: { length: "m", angle: "rad" },
    scene: {
      roomDimensions: scene.roomDimensions,
      architecturalAnchors: scene.architecturalAnchors,
      assets: scene.curatedAssets.map(({ priceAtCuration: _p, ...a }) => a),
    },
    camera: { fovDeg, durationSec: path.durationSec, fps: 24, lookAt: path.target.toArray() as [number, number, number], path: path.samples },
    render: { provider: "runway-gen3", style: "hyper-photorealistic", aspectRatio: "16:9" },
  };
}

export type ExportResult = { status: "dry-run"; payload: SceneVideoPayload } | { status: "queued"; payload: SceneVideoPayload; response: unknown };

/** POSTs the payload to the render webhook. While the placeholder URL is set, returns a dry run without any network call. */
export async function exportSceneToVideoAPI(scene: AICuratedSceneSchema, path: CinematicPath, brief: string, signal?: AbortSignal): Promise<ExportResult> {
  const payload = buildSceneVideoPayload(scene, path, brief);
  if (WEBHOOK === VIDEO_RENDER_WEBHOOK_PLACEHOLDER) return { status: "dry-run", payload };
  const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal });
  if (!res.ok) throw new Error(`Render request failed (${res.status})`);
  return { status: "queued", payload, response: await res.json().catch(() => null) };
}
