import type { MutableRefObject } from "react";
import type { PerspectiveCamera } from "three";
import type { OrbitControls } from "three-stdlib";

export type ComparisonCameraState = {
  source: string;
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  zoom: number;
  version: number;
};
export type ComparisonCameraLink = { id: string; shared: MutableRefObject<ComparisonCameraState | null>; enabled?: boolean };

// Each dialog owns a ref; WeakMap avoids retaining closed rooms or polling idle canvases.
const subscribers = new WeakMap<ComparisonCameraLink["shared"], Set<() => void>>();

export function bindComparisonCamera(
  { id, shared, enabled = true }: ComparisonCameraLink,
  camera: PerspectiveCamera,
  controls: OrbitControls,
  invalidate: () => void,
) {
  let applying = false;
  let version = -1;
  const listeners = subscribers.get(shared) ?? new Set<() => void>();
  subscribers.set(shared, listeners);

  const receive = () => {
    if (!enabled) return;
    const pose = shared.current;
    if (!pose || pose.version === version) return;
    applying = true;
    // Do not integrate a receiving control's leftover damping into the source pose.
    const damping = controls.enableDamping;
    try {
      controls.enableDamping = false;
      camera.position.fromArray(pose.position);
      camera.up.fromArray(pose.up);
      camera.fov = pose.fov;
      camera.zoom = pose.zoom;
      camera.updateProjectionMatrix();
      controls.target.fromArray(pose.target);
      controls.update();
      version = pose.version;
      invalidate();
    } finally {
      controls.enableDamping = damping;
      applying = false;
    }
  };
  const publish = () => {
    if (applying) return;
    version = (shared.current?.version ?? 0) + 1;
    shared.current = {
      source: id, position: camera.position.toArray(), target: controls.target.toArray(),
      up: camera.up.toArray(), fov: camera.fov, zoom: camera.zoom, version,
    };
    for (const listener of listeners) listener();
    invalidate();
  };
  listeners.add(receive);
  if (enabled) {
    if (shared.current) receive();
    else publish();
  }
  controls.addEventListener("change", publish);
  return () => {
    controls.removeEventListener("change", publish);
    listeners.delete(receive);
    if (listeners.size === 0) subscribers.delete(shared);
  };
}