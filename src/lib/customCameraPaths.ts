import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AICuratedSceneSchema, Vec3 } from "@/types/aiCuratedScene";
import { buildCinematicPath, type CinematicPath, type CinematicPreset } from "@/hooks/useCinematicPath";

export type PathMode = "capture" | "draw" | "text";
export type StorageMode = "layout" | "account" | "local" | "custom";
export interface CustomPathNode { position: Vec3; target: Vec3 }
export interface CustomCameraPath { id: string; name: string; mode: PathMode; nodes: CustomPathNode[]; description?: string }

const round = (v: THREE.Vector3) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)] as Vec3;
export const vec3 = (v: THREE.Vector3): Vec3 => round(v);

/** Furniture cluster centre at seated eye-focus height — the default look target. */
export function clusterCentre(scene: AICuratedSceneSchema): Vec3 {
  const a = scene.curatedAssets;
  if (!a.length) return [0, 0.6, 0];
  const x = a.reduce((s, p) => s + p.position[0], 0) / a.length;
  const z = a.reduce((s, p) => s + p.position[2], 0) / a.length;
  return [+x.toFixed(3), 0.6, +z.toFixed(3)];
}

/** Clamp nodes into the room envelope and build the same CinematicPath contract presets use. */
export function buildCustomCinematicPath(scene: AICuratedSceneSchema, nodes: CustomPathNode[], sampleCount = 120): CinematicPath | null {
  if (nodes.length < 2) return null;
  const { width: W, length: L, height: H } = scene.roomDimensions;
  const clampPos = (p: Vec3) => new THREE.Vector3(
    THREE.MathUtils.clamp(p[0], -W / 2 + 0.4, W / 2 - 0.4),
    THREE.MathUtils.clamp(p[1], 0.5, H - 0.2),
    THREE.MathUtils.clamp(p[2], -L / 2 + 0.4, L / 2 - 0.4));
  const pts = nodes.map((n) => clampPos(n.position));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
  if (curve.getLength() < 0.05) return null;
  const lookAtCurve = new THREE.CatmullRomCurve3(nodes.map((n) => new THREE.Vector3(...n.target)), false, "centripetal", 0.5);
  const samples = curve.getSpacedPoints(sampleCount - 1).map(round);
  const lookAtSamples = samples.map((_, i) => round(lookAtCurve.getPoint(curve.getUtoTmapping(i / (samples.length - 1), 0))));
  return { curve, target: lookAtCurve.getPoint(0), samples, lookAtCurve, lookAtSamples,
    durationSec: Math.max(12, nodes.length * 4, curve.getLength() / 0.45) };
}

export interface ClearanceConflict { label: string; kind: "furniture" | "window" | "door" | "wall_opening"; fromPct: number; toPct: number }

/** Conservative boxes: furniture uses SceneObject's 1.4m GLB fit (as presets do); anchors their unit box. */
export function checkPathClearance(scene: AICuratedSceneSchema, path: CinematicPath | null, margin = 0.2, steps = 400): ClearanceConflict[] {
  if (!path) return [];
  const boxes = [
    ...scene.curatedAssets.map((a) => ({ label: a.sku, kind: "furniture" as const, box: new THREE.Box3(new THREE.Vector3(-0.7, 0, -0.7), new THREE.Vector3(0.7, 1.4, 0.7))
      .applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...a.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...a.rotation)), new THREE.Vector3(...a.scale))) })),
    ...scene.architecturalAnchors.map((a, i) => ({ label: `${a.type.replace("_", " ")} ${i + 1}`, kind: a.type, box: new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5))
      .applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...a.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...a.rotation)), new THREE.Vector3(...a.scale))) })),
  ].map((b) => ({ ...b, box: b.box.expandByScalar(margin) }));
  const points = path.curve.getSpacedPoints(steps);
  const out: ClearanceConflict[] = [];
  for (const b of boxes) {
    let start = -1;
    points.forEach((p, i) => {
      const hit = b.box.containsPoint(p);
      if (hit && start < 0) start = i;
      if ((!hit || i === points.length - 1) && start >= 0) {
        out.push({ label: b.label, kind: b.kind, fromPct: Math.round(start / steps * 100), toPct: Math.round((hit ? i : i - 1) / steps * 100) });
        start = -1;
      }
    });
  }
  return out.sort((a, b) => a.fromPct - b.fromPct);
}

/** Natural-language description → nodes, derived from the validated preset matching its keywords. */
export function nodesFromDescription(scene: AICuratedSceneSchema, text: string): CustomPathNode[] {
  const t = text.toLowerCase();
  const preset: CinematicPreset = /orbit|circle|around|360/.test(t) ? "slow-orbit" : /tour|each|piece|furniture|close/.test(t) ? "furniture-tour" : "sweep";
  const path = buildCinematicPath(scene, 10, 24, preset);
  if (!path) return [];
  const centre = clusterCentre(scene);
  return path.samples.map((p, i) => ({ position: p, target: path.lookAtSamples?.[i] ?? centre }));
}

const sanitize = (nodes: CustomPathNode[]) => nodes.slice(0, 64).map((n) => ({ position: n.position.map(Number) as Vec3, target: n.target.map(Number) as Vec3 }));
const LOCAL_PREFIX = "cached_camera_path_";

export function readLocalPaths(layoutId: string): CustomCameraPath[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(LOCAL_PREFIX + layoutId) ?? "[]");
    return Array.isArray(raw) ? raw.filter((p) => p && Array.isArray(p.nodes)) as CustomCameraPath[] : [];
  } catch { return []; }
}

export async function listLayoutPaths(layoutId: string): Promise<CustomCameraPath[]> {
  const { data, error } = await supabase.from("ai_curated_layouts").select("camera_paths").eq("id", layoutId).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.camera_paths) ? data.camera_paths as unknown as CustomCameraPath[] : [];
}

export async function listAccountPaths(): Promise<CustomCameraPath[]> {
  const { data, error } = await supabase.from("user_saved_camera_paths").select("id, name, mode, nodes, description").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as CustomCameraPath[];
}

/** Persist per the chosen storage mode. 'custom' notes are stored with the path in this browser. */
export async function persistCustomPath(mode: StorageMode, path: CustomCameraPath, layoutId: string | null, customText?: string) {
  const clean: CustomCameraPath = { ...path, name: path.name.trim().slice(0, 120) || "Custom path", nodes: sanitize(path.nodes),
    description: (customText ?? path.description)?.slice(0, 1000) };
  if (mode === "layout") {
    if (!layoutId) throw new Error("Save the layout first to attach paths to it");
    const existing = await listLayoutPaths(layoutId);
    const { error } = await supabase.from("ai_curated_layouts").update({ camera_paths: [...existing.filter((p) => p.id !== clean.id), clean] as unknown as Json }).eq("id", layoutId);
    if (error) throw error;
  } else if (mode === "account") {
    const { error } = await supabase.from("user_saved_camera_paths").insert({ name: clean.name, mode: clean.mode, nodes: clean.nodes as unknown as Json, description: clean.description ?? null });
    if (error) throw error;
  } else {
    const key = layoutId ?? "unsaved";
    const all = [...readLocalPaths(key).filter((p) => p.id !== clean.id), clean];
    window.localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(all));
  }
  return clean;
}

/**
 * Upload every "This browser only" path (all layouts) to the signed-in account library,
 * removing each local copy only after its insert succeeds. Returns old local id → new account id.
 */
export async function syncLocalPathsToAccount(): Promise<Map<string, string>> {
  const moved = new Map<string, string>();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return moved;
  const keys = Object.keys(window.localStorage).filter((k) => k.startsWith(LOCAL_PREFIX));
  for (const key of keys) {
    const layoutId = key.slice(LOCAL_PREFIX.length);
    const remaining: CustomCameraPath[] = [];
    for (const p of readLocalPaths(layoutId)) {
      const { data, error } = await supabase.from("user_saved_camera_paths")
        .insert({ name: (p.name || "Custom path").slice(0, 120), mode: p.mode, nodes: sanitize(p.nodes) as unknown as Json, description: p.description?.slice(0, 1000) ?? null })
        .select("id").single();
      if (error || !data) remaining.push(p); else moved.set(p.id, data.id);
    }
    if (remaining.length) window.localStorage.setItem(key, JSON.stringify(remaining));
    else window.localStorage.removeItem(key);
  }
  return moved;
}

/**
 * Raise only the viewpoints near flagged stretches in 0.1 m steps (ceiling-capped) until the path
 * clears or nothing more can move. Returns the new nodes and any conflicts that still remain.
 */
export function autoRaiseFlaggedNodes(scene: AICuratedSceneSchema, nodes: CustomPathNode[], step = 0.1, maxIter = 40) {
  const ceiling = scene.roomDimensions.height - 0.2;
  let out = nodes.map((n) => ({ position: [...n.position] as Vec3, target: [...n.target] as Vec3 }));
  let conflicts = checkPathClearance(scene, buildCustomCinematicPath(scene, out));
  for (let it = 0; it < maxIter && conflicts.length && out.length > 1; it++) {
    const last = out.length - 1;
    let moved = false;
    out = out.map((n, i) => {
      const pct = (i / last) * 100;
      const near = conflicts.some((c) => pct >= c.fromPct - 100 / last && pct <= c.toPct + 100 / last);
      if (!near || n.position[1] >= ceiling) return n;
      moved = true;
      return { ...n, position: [n.position[0], +Math.min(ceiling, n.position[1] + step).toFixed(3), n.position[2]] as Vec3 };
    });
    if (!moved) break;
    conflicts = checkPathClearance(scene, buildCustomCinematicPath(scene, out));
  }
  return { nodes: out, conflicts };
}
