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
  `TradePortal_Mockup_${new Date().toISOString().slice(0, 10)}.png`;
