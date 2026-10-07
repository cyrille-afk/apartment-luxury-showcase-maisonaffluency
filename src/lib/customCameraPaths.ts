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
