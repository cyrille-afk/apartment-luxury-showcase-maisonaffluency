export type CanvasContextState = "ready" | "restoring" | "failed";

/** Keep the renderer alive: Three reinitializes its GPU resources on restoration. */
export function attachCanvasContextRecovery(canvas: HTMLCanvasElement, invalidate: () => void, onState: (state: CanvasContextState) => void, timeoutMs = 12000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lost = false;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const onLost = (event: Event) => {
    event.preventDefault();
    if (lost) return;
    lost = true;
    onState("restoring");
    timer = setTimeout(() => onState("failed"), timeoutMs);
  };
  const onRestored = () => {
    clear();
    lost = false;
    invalidate();
    onState("ready");
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return () => { clear(); canvas.removeEventListener("webglcontextlost", onLost); canvas.removeEventListener("webglcontextrestored", onRestored); };
}