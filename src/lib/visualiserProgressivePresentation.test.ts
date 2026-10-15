import { describe, expect, it, vi } from "vitest";
import { ShaderMaterial, WebGLRenderer, WebGLRenderTarget } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { configureProgressivePresentation, isCompletePhotorealSample } from "./visualiserProgressivePresentation";

describe("progressive photoreal presentation", () => {
  it("publishes all four tiles together, never a partially updated sample", () => {
    expect([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(isCompletePhotorealSample))
      .toEqual([false, false, false, false, true, false, false, false, true]);
  });

  it("clears only the display and dithers output without resetting accumulation", () => {
    const present = vi.fn();
    const reset = vi.fn();
    const tracer = { samples: 1.25, renderToCanvasCallback: present, reset };
    const renderer = Object.create(WebGLRenderer.prototype) as WebGLRenderer;
    renderer.getRenderTarget = vi.fn(() => null);
    renderer.getScissorTest = vi.fn(() => true);
    renderer.setRenderTarget = vi.fn();
    renderer.setScissorTest = vi.fn();
    renderer.clear = vi.fn();
    const material = new ShaderMaterial({ fragmentShader: "void main() { gl_FragColor = vec4(1.0);\n#include <premultiplied_alpha_fragment>\n}" });
    const quad = new FullScreenQuad(material);
    const accumulation = new WebGLRenderTarget(64, 64);
    configureProgressivePresentation(tracer);
    tracer.renderToCanvasCallback(accumulation, renderer, quad);
    expect(present).not.toHaveBeenCalled();
    expect(renderer.clear).not.toHaveBeenCalled();
    tracer.samples = 2;
    tracer.renderToCanvasCallback(accumulation, renderer, quad);
    expect(present).toHaveBeenCalledOnce();
    expect(renderer.setRenderTarget).toHaveBeenNthCalledWith(1, null);
    expect(renderer.clear).toHaveBeenCalledWith(true, true, true);
    expect(material.dithering).toBe(true);
    expect(reset).not.toHaveBeenCalled();
    expect(tracer.samples).toBe(2);
    expect(renderer.setScissorTest).toHaveBeenLastCalledWith(true);
    quad.dispose(); material.dispose(); accumulation.dispose();
  });
});