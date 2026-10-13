/**
 * Canvas mockup export helpers for the Visualiser.
 *
 * The R3F canvas runs with `preserveDrawingBuffer: true` (see
 * VisualiserCanvas) so `toDataURL` can read back the last rendered frame
 * instead of a wiped buffer.
 */

/** Wait for the next painted frame (double rAF covers the demand-mode redraw). */
export const nextPaintedFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/** Trigger a browser download for a base64 data URL without leaving the page. */
export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export const mockupFilename = () =>
  `TradePortal_Sandbox_Presentation_${new Date().toISOString().slice(0, 10)}.png`;

/** The sandbox page background — exported PNGs composite onto this so the
 *  transparent WebGL buffer never ships as a see-through image. */
export const MOCKUP_BACKGROUND = "#F9F8F6";

/**
 * Capture the WebGL canvas as an opaque PNG data URL. The renderer runs with
 * `alpha: true`, so raw `toDataURL` would produce transparent pixels wherever
 * no geometry was drawn; compositing onto the page background keeps client
 * mockups clean and printable.
 */
export const captureCanvasPng = (canvas: HTMLCanvasElement, background: string = MOCKUP_BACKGROUND): string => {
  const composite = document.createElement("canvas");
  composite.width = canvas.width;
  composite.height = canvas.height;
  const ctx = composite.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, composite.width, composite.height);
  ctx.drawImage(canvas, 0, 0);
  return composite.toDataURL("image/png");
};
