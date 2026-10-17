import { render, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import PathTracerLayer from './PathTracerLayer';
const harness = vi.hoisted(() => ({ frame: null as null | (() => void), pt: null as any, invalidate: vi.fn() }));
const camera = new THREE.PerspectiveCamera();
const scene = new THREE.Scene();
const gl = { getPixelRatio: () => 1, render: vi.fn(), domElement: document.createElement('canvas') };
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ gl, camera, scene, invalidate: harness.invalidate }),
  useFrame: (fn: () => void) => { harness.frame = fn; },
}));
vi.mock('three-gpu-pathtracer', async () => {
  const three = await import('three');
  return {
    PhysicalCamera: class extends three.PerspectiveCamera {},
    WebGLPathTracer: class {
      samples = 0; renderScale = 1; lowResScale = 1; pausePathTracing = false;
      tiles = { set: vi.fn() };
      constructor() { harness.pt = this; }
      setScene = vi.fn(() => { this.samples = 0; });
      updateCamera = vi.fn(() => { this.samples = 0; });
      updateEnvironment = vi.fn(() => { this.samples = 0; });
      dispose = vi.fn();
      renderSample = vi.fn(() => { if (!this.pausePathTracing) this.samples += 1; });
    },
  };
});
vi.mock('@/lib/visualiserProgressivePresentation', () => ({ configureProgressivePresentation: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); });
describe('Photoreal tab continuity', () => {
  it('retains 2500 accumulated samples across hide, focus and an unchanged React refresh', () => {
    let now = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const props = { signature: 'unchanged-room', quality: { renderScale: 1, previewScale: 1, maxSamples: 0, lightIntensity: 1 }, focusTarget: new THREE.Vector3(), adaptive: true };
    const view = render(<PathTracerLayer {...props} />);
    act(() => harness.frame?.());
    now = 2000;
    act(() => harness.frame?.());
    const pt = harness.pt;
    pt.samples = 2500;
    const resets = pt.setScene.mock.calls.length;
    hidden.mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); harness.frame?.(); });
    expect(pt.samples).toBe(2500);
    now = 62000;
    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
    view.rerender(<PathTracerLayer {...props} />);
    act(() => harness.frame?.());
    expect(harness.pt).toBe(pt);
    expect(pt.samples).toBe(2501);
    expect(pt.setScene).toHaveBeenCalledTimes(resets);
    expect(pt.updateCamera).not.toHaveBeenCalled();
    expect(pt.updateEnvironment).not.toHaveBeenCalled();
    view.unmount();
  });
});
