import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as THREE from "three";
import VisualiserHotspots from "./VisualiserHotspots";

const state = vi.hoisted(() => ({ frame: null as (() => void) | null, canvas: null as HTMLCanvasElement | null, camera: null as THREE.PerspectiveCamera | null }));
vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: () => void) => { state.frame = callback; },
  useThree: () => ({ camera: state.camera, gl: { domElement: state.canvas }, size: { width: 800, height: 600 }, invalidate: () => {} }),
}));
afterEach(() => { cleanup(); delete window.__lovableEvents; document.body.innerHTML = ""; vi.unstubAllGlobals(); });
it("identifies a hotspot projection failure separately and preserves the original exception", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const host = document.createElement("div"); state.canvas = document.createElement("canvas"); host.append(state.canvas); document.body.append(host);
  state.camera = new THREE.PerspectiveCamera(60, 4 / 3, .1, 100);
  const failure = new Error("Controlled projection failure");
  vi.spyOn(state.camera, "updateMatrixWorld").mockImplementation(() => { throw failure; });
  const track = vi.fn(); const captureException = vi.fn(); window.__lovableEvents = { track, captureException };
  render(<VisualiserHotspots objects={[]} onFindAlternatives={() => {}} />);
  expect(() => state.frame?.()).toThrow(failure);
  expect(track).toHaveBeenCalledWith("project.studio_loading", expect.objectContaining({ phase: "hotspot_error", status: "error", piece_count: 0, pin_count: 0 }));
  expect(captureException).toHaveBeenCalledWith(failure, { source: "visualiser_hotspot_projection", piece_count: 0 }, { mechanism: "manual", handled: false, severity: "error" });
});
it("reports at most two CPU samples per 120 frames rather than sending every frame", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const host = document.createElement("div"); state.canvas = document.createElement("canvas"); host.append(state.canvas); document.body.append(host);
  state.camera = new THREE.PerspectiveCamera(60, 4 / 3, .1, 100);
  const track = vi.fn(); window.__lovableEvents = { track };
  render(<VisualiserHotspots objects={[]} onFindAlternatives={() => {}} />);
  act(() => { for (let i = 0; i < 180; i++) state.frame?.(); });
  const samples = track.mock.calls.filter(([, properties]) => properties?.phase === "hotspot_frames");
  expect(samples).toHaveLength(2);
  expect(samples.map(([, properties]) => properties.sample_count)).toEqual([60, 120]);
  expect(samples[0]?.[1]).toMatchObject({ piece_count: 0, pin_count: 0, status: "ok" });
});