import { describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import * as THREE from "three";
import { captureAccumulation, renderFingerprint, restoreAccumulation, saveRenderCheckpoint, loadRenderCheckpoint, validCheckpoint, type RenderCheckpoint } from "../visualiserRenderCheckpoint";
const value = (): RenderCheckpoint => ({ version: 1, signature: "room", fingerprint: "abc", savedAt: 1, samples: 2500, width: 1, height: 1, pixels: new Float32Array([2.5, 3, 4, 1]), alpha: true, seed: 2500, renderScale: 1, camera: { position: [0, 1, 2], quaternion: [0, 0, 0, 1], target: [0, 1, 0] } });
describe("Photoreal checkpoints", () => {
  it("restores the exact HDR average and 2500 SPP from persistent storage", async () => {
    await saveRenderCheckpoint("account:sandbox", value());
    const saved = await loadRenderCheckpoint("account:sandbox");
    expect(saved?.samples).toBe(2500);
    expect(saved?.pixels).toEqual(new Float32Array([2.5, 3, 4, 1]));
    expect(await loadRenderCheckpoint("other-account:sandbox")).toBeNull();
  });
  it("never checkpoints fractional tile progress", () => {
    const pt = { _queueReset: false, samples: 2500.25, _pathTracer: { _primaryTarget: {}, _blendTargets: [{}, {}] } };
    const read = vi.fn();
    expect(captureAccumulation(pt as any, { readRenderTargetPixels: read } as any)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it("rejects malformed or non-finite accumulation", () => {
    expect(validCheckpoint(value())).toBe(true);
    expect(validCheckpoint({ ...value(), pixels: new Float32Array([NaN, 0, 0, 1]) })).toBe(false);
    expect(validCheckpoint({ ...value(), samples: 2500.25 })).toBe(false);
  });
  it("uploads both alpha histories before restoring sample count and clearing the old tile task", () => {
    const targets = [new THREE.WebGLRenderTarget(1, 1), new THREE.WebGLRenderTarget(1, 1)];
    const engine = { alpha: true, samples: 0, material: { seed: 0 }, _task: {}, _currentTile: 2, _primaryTarget: new THREE.WebGLRenderTarget(1, 1), _blendTargets: targets };
    const pt = { _queueReset: false, isCompiling: false, target: targets[1], _pathTracer: engine };
    const uploaded: Float32Array[] = [];
    const gl = { getRenderTarget: () => null, getScissorTest: () => true, setRenderTarget: vi.fn(), setScissorTest: vi.fn(), render: (mesh: any) => { expect(engine.samples).toBe(0); uploaded.push(mesh.material.uniforms.image.value.image.data); } };
    expect(restoreAccumulation(pt as any, gl as any, value())).toBe(true);
    expect(uploaded).toEqual([value().pixels, value().pixels]);
    expect(engine.samples).toBe(2500); expect(engine.material.seed).toBe(2500); expect(engine._task).toBeNull();
    expect((2500 * uploaded[0][0] + 5) / 2501).toBeCloseTo(2.5009996);
    pt._queueReset = true;
    expect(restoreAccumulation(pt as any, gl as any, value())).toBe(false);
  });
  it("stable scene fingerprints survive new UUIDs but reject finish, camera and geometry changes", () => {
    const scene = () => { const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.6 }))); s.updateMatrixWorld(true); return s; };
    const a = scene(); const b = scene(); const camera = new THREE.PerspectiveCamera(); camera.updateMatrixWorld();
    const before = renderFingerprint(a, camera, "room", [1, 5]);
    expect(renderFingerprint(b, camera, "room", [1, 5])).toBe(before);
    (b.children[0] as THREE.Mesh).position.x = 1; b.updateMatrixWorld(true);
    expect(renderFingerprint(b, camera, "room", [1, 5])).not.toBe(before);
    const c = scene(); ((c.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).roughness = 0.2;
    expect(renderFingerprint(c, camera, "room", [1, 5])).not.toBe(before);
    camera.position.z = 3; camera.updateMatrixWorld();
    expect(renderFingerprint(a, camera, "room", [1, 5])).not.toBe(before);
  });
});