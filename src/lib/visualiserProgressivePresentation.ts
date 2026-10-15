import { ShaderMaterial } from "three";
import type { WebGLPathTracer } from "three-gpu-pathtracer";

/** Never display a mix of two sample passes across the tile boundaries. */
export const isCompletePhotorealSample = (samples: number) =>
  Number.isFinite(samples) && samples >= 1 && Math.abs(samples - Math.round(samples)) < 1e-6;

/** Preserve the floating-point accumulation; clear only the displayed framebuffer. */
export function configureProgressivePresentation(tracer: Pick<WebGLPathTracer, "samples" | "renderToCanvasCallback">) {
  const present = tracer.renderToCanvasCallback;
  tracer.renderToCanvasCallback = (target, renderer, quad) => {
    if (!isCompletePhotorealSample(tracer.samples)) return;
    // Three.js dithering belongs to materials, not WebGLRenderer. The library's
    // output shader needs the chunks as well as the DITHERING material define.
    const material = quad.material;
    if (material instanceof ShaderMaterial && !material.dithering) {
      material.fragmentShader = `#include <dithering_pars_fragment>\n${material.fragmentShader}`
        .replace("#include <premultiplied_alpha_fragment>",
          "#include <premultiplied_alpha_fragment>\n#include <dithering_fragment>");
      material.dithering = true;
      material.needsUpdate = true;
    }
    const renderTarget = renderer.getRenderTarget();
    const scissorTest = renderer.getScissorTest();
    try {
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.clear(true, true, true);
      present(target, renderer, quad);
    } finally {
      renderer.setScissorTest(scissorTest);
      renderer.setRenderTarget(renderTarget);
    }
  };
}